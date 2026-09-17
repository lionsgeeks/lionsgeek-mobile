import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
  StatusBar as RNStatusBar,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import API from '@/api';
import OverlayRenderer from '../Partials/OverlayRenderer';
import StoryMediaFrame from '../Partials/StoryMediaFrame';
import useStoryMusic from '../Partials/useStoryMusic';
import ReportReasonModal from '@/components/moderation/ReportReasonModal';

const { width: WINDOW_W, height: WINDOW_H } = Dimensions.get('window');
const TOP_INSET = (Platform.OS === 'ios' ? 54 : RNStatusBar.currentHeight ?? 24) + 6;
const TAP_ZONE_WIDTH = WINDOW_W * 0.30;
const SWIPE_DOWN_THRESHOLD = 120;

/**
 * Full-screen viewer for a single highlight's stories.
 *
 * Same gesture / progress-bar model as the regular story viewer, but without
 * reactions/replies/user-jumping. The owner can long-press to remove a
 * specific item from the highlight.
 */
export default function HighlightViewerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { token, user } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [highlight, setHighlight] = useState(null);
  const [storyIdx, setStoryIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [musicPaused, setMusicPaused] = useState(false);
  const [viewerActive, setViewerActive] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);

  const videoRef = useRef(null);
  const progress = useSharedValue(0);
  const isPausedRef = useRef(false);
  const animatingExitRef = useRef(false);
  const closingRef = useRef(false);
  const advancingRef = useRef(false);
  const translateY = useSharedValue(0);

  const stories = highlight?.stories || [];
  const currentStory = stories[storyIdx] || null;
  const isOwner = !!(highlight && user && highlight.user_id === user.id);
  const musicOverlay = (currentStory?.overlays || []).find((o) => o.type === 'music') || null;

  useFocusEffect(
    useCallback(() => {
      animatingExitRef.current = false;
      closingRef.current = false;
      isPausedRef.current = false;
      setMusicPaused(false);
      setViewerActive(true);
      translateY.value = 0;
      return () => {
        setViewerActive(false);
        setMusicPaused(true);
        isPausedRef.current = true;
        try { videoRef.current?.pause?.(); } catch (_) {}
      };
    }, [translateY]),
  );

  useStoryMusic(musicOverlay, {
    isPaused: musicPaused || muted || !viewerActive,
    enabled: viewerActive,
  });

  // Load highlight
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id || !token) return;
      try {
        const data = await API.getHighlight(id, token);
        if (cancelled) return;
        setHighlight(data?.highlight || null);
      } catch (e) {
        if (cancelled) return;
        setHighlight(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, token]);

  const advance = useCallback(() => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    setStoryIdx((idx) => {
      if (idx + 1 < stories.length) return idx + 1;
      doClose();
      return idx;
    });
  }, [stories.length]);

  const startProgress = useCallback((durationMs) => {
    if (!currentStory) return;
    cancelAnimation(progress);
    progress.value = 0;
    const duration = Math.max(1500, durationMs || 5000);
    progress.value = withTiming(1, { duration, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(advance)();
    });
  }, [currentStory, advance]);

  useEffect(() => {
    advancingRef.current = false;
    if (!currentStory) return undefined;
    if (currentStory.media_type === 'video') {
      setVideoReady(false);
      cancelAnimation(progress);
      progress.value = 0;
      return () => cancelAnimation(progress);
    }
    startProgress(currentStory.duration_ms || 5000);
    return () => cancelAnimation(progress);
  }, [currentStory?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentStory || currentStory.media_type !== 'video' || !videoReady) return undefined;
    startProgress(currentStory.duration_ms || 15000);
    return () => cancelAnimation(progress);
  }, [currentStory?.id, videoReady, startProgress]); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = useCallback(() => {
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    setMusicPaused(true);
    cancelAnimation(progress);
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch (_) {}
    }
  }, []);

  const resume = useCallback(() => {
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    setMusicPaused(false);
    if (!currentStory) return;
    const remaining = Math.max(0, 1 - progress.value);
    const duration = Math.max(500, Math.round((currentStory.duration_ms || 5000) * remaining));
    progress.value = withTiming(1, { duration, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(advance)();
    });
    if (videoRef.current) {
      try { videoRef.current.play(); } catch (_) {}
    }
  }, [currentStory, advance]);

  const goPrev = useCallback(() => {
    setStoryIdx((idx) => (idx > 0 ? idx - 1 : idx));
  }, []);
  const goNext = useCallback(() => advance(), [advance]);

  const leaveHighlight = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    animatingExitRef.current = false;
    isPausedRef.current = true;
    setMusicPaused(true);
    setViewerActive(false);
    try { videoRef.current?.pause?.(); } catch (_) {}
    try {
      if (typeof router.canDismiss === 'function' && router.canDismiss()) {
        router.dismiss();
      } else {
        router.replace('/(tabs)/home');
      }
    } catch (_) {
      try { router.replace('/(tabs)/home'); } catch (__) {}
    }
  }, [router]);

  const doClose = useCallback(() => {
    isPausedRef.current = true;
    setMusicPaused(true);
    setViewerActive(false);
    cancelAnimation(progress);
    try { videoRef.current?.pause?.(); } catch (_) {}
    if (animatingExitRef.current || closingRef.current) {
      leaveHighlight();
      return;
    }
    animatingExitRef.current = true;
    translateY.value = withTiming(WINDOW_H, { duration: 220 }, (finished) => {
      if (finished) runOnJS(leaveHighlight)();
    });
  }, [leaveHighlight, progress, translateY]);

  const tapGesture = Gesture.Tap()
    .maxDuration(220)
    .onEnd((e) => {
      if (e.x < TAP_ZONE_WIDTH) runOnJS(goPrev)();
      else runOnJS(goNext)();
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(180)
    .onStart(() => { runOnJS(pause)(); })
    .onEnd(() => { runOnJS(resume)(); })
    .onTouchesUp(() => { runOnJS(resume)(); });

  const panGesture = Gesture.Pan()
    .activeOffsetY(15)
    .failOffsetY(-15)
    .onStart(() => { runOnJS(pause)(); })
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > SWIPE_DOWN_THRESHOLD || e.velocityY > 800) {
        runOnJS(doClose)();
      } else {
        translateY.value = withTiming(0, { duration: 200 });
        runOnJS(resume)();
      }
    });

  const composed = Gesture.Simultaneous(panGesture, Gesture.Exclusive(longPressGesture, tapGesture));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: 1 - Math.min(translateY.value / 400, 0.6),
  }));

  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const handleEditHighlight = useCallback(() => {
    if (!isOwner || !highlight || !currentStory) return;
    pause();
    Alert.alert(
      highlight.title || 'Highlight',
      'Rename this highlight or use the current story as the cover.',
      [
        { text: 'Cancel', style: 'cancel', onPress: resume },
        {
          text: 'Set cover',
          onPress: async () => {
            try {
              const data = await API.updateHighlight(highlight.id, { coverStoryId: currentStory.id }, token);
              if (data?.highlight) setHighlight((prev) => ({ ...prev, ...data.highlight, stories: prev?.stories }));
              resume();
            } catch (e) {
              Alert.alert('Error', e?.message || 'Could not update cover.');
              resume();
            }
          },
        },
        {
          text: 'Rename',
          onPress: () => {
            Alert.prompt?.(
              'Rename highlight',
              undefined,
              async (title) => {
                const next = (title || '').trim();
                if (!next) { resume(); return; }
                try {
                  const data = await API.updateHighlight(highlight.id, { title: next }, token);
                  if (data?.highlight) setHighlight((prev) => ({ ...prev, ...data.highlight, stories: prev?.stories }));
                } catch (e) {
                  Alert.alert('Error', e?.message || 'Could not rename.');
                }
                resume();
              },
              'plain-text',
              highlight.title || '',
            );
            if (!Alert.prompt) resume();
          },
        },
      ],
    );
  }, [isOwner, highlight, currentStory, token, pause, resume]);

  const handleRemove = useCallback(() => {
    if (!isOwner || !currentStory || !highlight) return;
    pause();
    Alert.alert(
      'Remove from highlight?',
      'This will only remove it from this highlight.',
      [
        { text: 'Cancel', style: 'cancel', onPress: resume },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await API.removeStoryFromHighlight(highlight.id, currentStory.id, token);
              // If the highlight is now empty, the server deletes it for us.
              if (res?.deleted) {
                doClose();
                return;
              }
              const newStories = stories.filter((s) => s.id !== currentStory.id);
              if (newStories.length === 0) {
                doClose();
                return;
              }
              setHighlight((prev) => prev ? { ...prev, stories: newStories } : prev);
              setStoryIdx((i) => Math.min(i, newStories.length - 1));
            } catch (e) {
              Alert.alert('Error', e?.message || 'Could not remove.');
              resume();
            }
          },
        },
      ],
    );
  }, [isOwner, currentStory, highlight, stories, token, pause, resume, doClose]);

  const confirmBlock = useCallback(() => {
    const targetId = highlight?.user_id;
    if (!targetId || !token) {
      resume();
      return;
    }
    Alert.alert(
      'Block this person?',
      'You will no longer see each other\'s stories.',
      [
        { text: 'Cancel', style: 'cancel', onPress: resume },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await API.blockUser(targetId, token);
              doClose();
            } catch (e) {
              Alert.alert('Could not block', e?.message || 'Try again.');
              resume();
            }
          },
        },
      ],
    );
  }, [highlight, token, resume, doClose]);

  const openSafetyMenu = useCallback(() => {
    if (isOwner) return;
    pause();
    Alert.alert(
      highlight?.title || 'Highlight',
      'Report or block.',
      [
        { text: 'Report', onPress: () => setReportOpen(true) },
        { text: 'Block', style: 'destructive', onPress: confirmBlock },
        { text: 'Cancel', style: 'cancel', onPress: resume },
      ],
    );
  }, [isOwner, highlight, pause, confirmBlock, resume]);

  const handleReport = useCallback(async (reason) => {
    if (!currentStory || !token) return;
    setReportBusy(true);
    try {
      await API.reportStory(currentStory.id, reason, token);
      setReportOpen(false);
      Alert.alert('Report sent', 'Thanks. Our team will review this story.');
      resume();
    } catch (e) {
      Alert.alert('Could not report', e?.message || 'Try again.');
    } finally {
      setReportBusy(false);
    }
  }, [currentStory, token, resume]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!highlight || stories.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <StatusBar style="light" />
        <Ionicons name="albums-outline" size={48} color="rgba(255,255,255,0.5)" />
        <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 12, textAlign: 'center' }}>
          This highlight is empty.
        </Text>
        <Pressable
          onPress={leaveHighlight}
          style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: '#ffc801' }}
        >
          <Text style={{ color: '#000', fontWeight: '800' }}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" hidden={false} />
      <GestureDetector gesture={composed}>
        <Animated.View style={[{ flex: 1, backgroundColor: '#000' }, containerStyle]}>
          {/* Media layer */}
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            {currentStory.media_type === 'video' ? (
              <StoryMediaFrame
                key={currentStory.id}
                story={currentStory}
                style={{ width: WINDOW_W, height: WINDOW_H }}
                videoProps={{
                  shouldPlay: !isPausedRef.current,
                  muted: muted || ((typeof musicOverlay?.original_volume === 'number' ? musicOverlay.original_volume : (musicOverlay ? 0 : 1)) <= 0.01),
                  playerRef: videoRef,
                  onReady: () => setVideoReady(true),
                  onError: () => {
                    setVideoReady(true);
                    advance();
                  },
                  onEnd: advance,
                }}
              />
            ) : (
              <StoryMediaFrame
                key={currentStory.id}
                story={currentStory}
                style={{ width: WINDOW_W, height: WINDOW_H }}
              />
            )}

            {currentStory.media_type === 'video' && !videoReady ? (
              <ActivityIndicator size="large" color="#fff" style={{ position: 'absolute' }} />
            ) : null}

            <OverlayRenderer
              overlays={currentStory.overlays}
              musicAnimated={!musicPaused}
              interactions={currentStory.interactions}
              isMine={isOwner}
              onMentionPress={(o) => {
                if (!o?.user_id) return;
                pause();
                doClose();
                setTimeout(() => router.push(`/(tabs)/profile?userId=${o.user_id}`), 240);
              }}
            />
          </View>

          {/* Top overlay */}
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: TOP_INSET, paddingHorizontal: 10 }}
          >
            <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 4 }}>
              {stories.map((_, i) => {
                const isPast = i < storyIdx;
                const isCurrent = i === storyIdx;
                return (
                  <View
                    key={i}
                    style={{ flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}
                  >
                    {isPast ? (
                      <View style={{ width: '100%', height: '100%', backgroundColor: '#fff' }} />
                    ) : isCurrent ? (
                      <Animated.View style={[{ height: '100%', backgroundColor: '#fff' }, progressFillStyle]} />
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingHorizontal: 6 }}>
              <View style={{
                width: 32, height: 32, borderRadius: 16, overflow: 'hidden',
                backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
              }}>
                {highlight.cover_url ? (
                  <Image source={{ uri: highlight.cover_url }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Ionicons name="albums" size={16} color="rgba(255,255,255,0.7)" />
                )}
              </View>
              <Text style={{ color: '#fff', marginLeft: 10, fontWeight: '800', fontSize: 14 }} numberOfLines={1}>
                {highlight.title}
              </Text>

              <View style={{ flex: 1 }} />

              {!isOwner ? (
                <Pressable onPress={openSafetyMenu} hitSlop={10} style={[topBtn, { marginLeft: 6 }]} accessibilityLabel="Highlight options">
                  <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
                </Pressable>
              ) : null}

              {currentStory.media_type === 'video' || !!musicOverlay ? (
                <Pressable
                  onPress={() => setMuted((m) => !m)}
                  hitSlop={10}
                  style={topBtn}
                >
                  <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
                </Pressable>
              ) : null}

              {isOwner ? (
                <Pressable onPress={handleEditHighlight} hitSlop={10} style={[topBtn, { marginLeft: 6 }]}>
                  <Ionicons name="create-outline" size={18} color="#fff" />
                </Pressable>
              ) : null}

              {isOwner ? (
                <Pressable onPress={handleRemove} hitSlop={10} style={[topBtn, { marginLeft: 6 }]}>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                </Pressable>
              ) : null}

              <Pressable onPress={doClose} hitSlop={10} style={[topBtn, { marginLeft: 6 }]}>
                <Ionicons name="close" size={20} color="#fff" />
              </Pressable>
            </View>

            {musicOverlay?.display === 'none' && (musicOverlay.title || musicOverlay.artist) ? (
              <View
                style={{
                  marginTop: 8,
                  paddingHorizontal: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Ionicons name="musical-notes" size={14} color="rgba(255,255,255,0.65)" />
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 12.5, fontWeight: '700' }}
                >
                  {[musicOverlay.title, musicOverlay.artist].filter(Boolean).join(' · ')}
                </Text>
              </View>
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
      <ReportReasonModal
        visible={reportOpen}
        onClose={() => { setReportOpen(false); resume(); }}
        onSubmit={handleReport}
        submitting={reportBusy}
        title="Report story"
        isDark
      />
    </GestureHandlerRootView>
  );
}

const topBtn = {
  width: 36, height: 36, borderRadius: 18,
  backgroundColor: 'rgba(0,0,0,0.35)',
  alignItems: 'center', justifyContent: 'center',
};
