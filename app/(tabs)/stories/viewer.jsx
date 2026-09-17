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
import { resolveAvatarUrl } from '@/components/helpers/helpers';
import API from '@/api';
import ViewerListSheet from './Partials/ViewerListSheet';
import EmojiReactionRow from './Partials/EmojiReactionRow';
import StoryReplyInput from './Partials/StoryReplyInput';
import SaveToHighlightSheet from './Partials/SaveToHighlightSheet';
import OverlayRenderer from './Partials/OverlayRenderer';
import StoryMediaFrame from './Partials/StoryMediaFrame';
import useStoryMusic from './Partials/useStoryMusic';
import { useStoryCaptureReport } from '@/hooks/useStoryCaptureReport';
import ReportReasonModal from '@/components/moderation/ReportReasonModal';
import UserPickerSheet from './Partials/editor/UserPickerSheet';

const { width: WINDOW_W, height: WINDOW_H } = Dimensions.get('window');
const TOP_INSET = (Platform.OS === 'ios' ? 54 : RNStatusBar.currentHeight ?? 24) + 6;
const TAP_ZONE_WIDTH = WINDOW_W * 0.30; // left/right tap zones
const SWIPE_DOWN_THRESHOLD = 120;
const SWIPE_UP_THRESHOLD = 80;

function firstUnseenIndex(group) {
  const stories = group?.stories || [];
  const idx = stories.findIndex((s) => !s.has_viewed);
  return idx >= 0 ? idx : 0;
}

/**
 * Premium-feel story viewer.
 *
 * Gestures (all snappy & Reanimated-driven):
 *   - tap left  → previous story
 *   - tap right → next story
 *   - press+hold (anywhere) → pause progress + pause video
 *   - swipe down → close viewer (translated card slides down)
 *
 * Behaviours:
 *   - per-story progress bars at the top, auto-advancing
 *   - auto-advances to the next user when reaching the last story
 *   - auto-closes when reaching the last story of the last user
 *   - records "view" on the backend the moment a story is shown
 *   - mute toggle for video stories
 *   - delete button on own stories
 *
 * Data:
 *   Fetches /api/mobile/stories itself (so we get fresh viewed flags) and
 *   jumps to `startUserId`'s group as the initial slide.
 */
export default function StoryViewerScreen() {
  const router = useRouter();
  const { startUserId } = useLocalSearchParams();
  const { token, user } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [userIdx, setUserIdx] = useState(0);
  const [storyIdx, setStoryIdx] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [viewerSheetOpen, setViewerSheetOpen] = useState(false);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [replying, setReplying] = useState(false);
  // Reactive paused flag for the music hook (kept in sync with isPausedRef).
  const [musicPaused, setMusicPaused] = useState(false);
  // False while blurred / closing — Expo Router may keep this screen mounted.
  const [viewerActive, setViewerActive] = useState(true);
  // Local override for reaction & counts so the UI feels instant when the
  // user taps an emoji; the server response then confirms / corrects.
  const [reactionOverride, setReactionOverride] = useState({}); // { [storyId]: emoji }
  const [reactionCountOverride, setReactionCountOverride] = useState({}); // { [storyId]: count }
  const [mentionRepostBusy, setMentionRepostBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const videoRef = useRef(null);
  const progress = useSharedValue(0); // 0..1 for the current story
  const isPausedRef = useRef(false);
  // Blocks resume/advance while a sheet/modal is open (swipe-up viewers, etc.).
  const interactionLockRef = useRef(false);
  const lastTickRef = useRef(0);
  const animatingExitRef = useRef(false);
  const closingRef = useRef(false);
  const sentViewIds = useRef(new Set());
  const advancingRef = useRef(false);
  const [mediaFailed, setMediaFailed] = useState(false);

  // Animated translateY for swipe-down dismiss.
  const translateY = useSharedValue(0);

  // Screen is often reused (same startUserId) — reset exit animation so
  // second open isn't stuck off-screen (black).
  useFocusEffect(
    useCallback(() => {
      animatingExitRef.current = false;
      closingRef.current = false;
      interactionLockRef.current = false;
      isPausedRef.current = false;
      setMusicPaused(false);
      setViewerActive(true);
      setViewerSheetOpen(false);
      translateY.value = 0;
      return () => {
        // Stop all audio immediately on blur — screen may stay mounted in the stack.
        setViewerActive(false);
        setMusicPaused(true);
        isPausedRef.current = true;
        interactionLockRef.current = true;
        try { videoRef.current?.pause?.(); } catch (_) {}
      };
    }, [translateY]),
  );

  const currentGroup = groups[userIdx] || null;
  const currentStory = currentGroup?.stories?.[storyIdx] || null;
  const totalStoriesInGroup = currentGroup?.stories?.length || 0;
  const musicOverlay = (currentStory?.overlays || []).find((o) => o.type === 'music') || null;

  // Play the story's music sticker (if any). Looped to its trim window and
  // tied to the story's pause state. Hook handles null overlays gracefully.
  useStoryMusic(musicOverlay, {
    isPaused: musicPaused || muted || !viewerActive,
    enabled: viewerActive,
  });

  const onCaptureReport = useCallback((storyId, kind, tok) => {
    API.reportStoryCaptureEvent(storyId, kind, tok).catch(() => {});
  }, []);

  useStoryCaptureReport({
    storyId: currentStory?.id ?? null,
    token,
    enabled: !!currentStory && !currentStory.is_mine,
    onReport: onCaptureReport,
  });

  // ────────────────────────────────────────────────────────────────────
  // Load stories
  // ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) return;
      try {
        const data = await API.listStories(token);
        if (cancelled) return;
        const g = Array.isArray(data?.groups) ? data.groups : [];
        setGroups(g);
        if (g.length === 0) return;
        let idx = 0;
        if (startUserId != null) {
          const found = g.findIndex((x) => String(x.user?.id) === String(startUserId));
          if (found >= 0) idx = found;
        }
        setUserIdx(idx);
        setStoryIdx(firstUnseenIndex(g[idx]));
      } catch (e) {
        console.warn('[viewer] load failed', e?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, startUserId]);

  // ────────────────────────────────────────────────────────────────────
  // View tracking (record once per story)
  // ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentStory || !token) return;
    const id = currentStory.id;
    if (sentViewIds.current.has(id)) return;
    sentViewIds.current.add(id);
    API.viewStory(id, token).catch(() => {});
  }, [currentStory, token]);

  // ────────────────────────────────────────────────────────────────────
  // Progress animation
  // ────────────────────────────────────────────────────────────────────
  const doCloseRef = useRef(() => {});

  const advance = useCallback(() => {
    if (interactionLockRef.current) return;
    if (advancingRef.current) return;
    advancingRef.current = true;
    setStoryIdx((idx) => {
      const total = groups[userIdx]?.stories?.length || 0;
      if (idx + 1 < total) {
        return idx + 1;
      }
      const nextUser = userIdx + 1;
      if (nextUser < groups.length) {
        setUserIdx(nextUser);
        return firstUnseenIndex(groups[nextUser]);
      }
      // Never call navigation/close inside a setState updater.
      queueMicrotask(() => {
        try { doCloseRef.current?.(); } catch (_) {}
      });
      return idx;
    });
  }, [groups, userIdx]);

  const startProgress = useCallback((durationMs) => {
    if (!currentStory) return;
    cancelAnimation(progress);
    progress.value = 0;
    const duration = Math.max(1500, durationMs || 5000);
    progress.value = withTiming(1, {
      duration,
      easing: Easing.linear,
    }, (finished) => {
      if (finished) runOnJS(advance)();
    });
  }, [currentStory, advance]);

  useEffect(() => {
    advancingRef.current = false;
    setMediaFailed(false);
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

  useEffect(() => {
    if (!currentStory?.expires_at) return undefined;
    const remaining = new Date(currentStory.expires_at).getTime() - Date.now();
    if (remaining <= 0) {
      advance();
      return undefined;
    }
    const timer = setTimeout(() => advance(), remaining);
    return () => clearTimeout(timer);
  }, [currentStory?.id, currentStory?.expires_at, advance]);

  const pause = useCallback(() => {
    if (isPausedRef.current) return;
    isPausedRef.current = true;
    setMusicPaused(true);
    cancelAnimation(progress);
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch (_) {}
    }
  }, [progress]);

  const forcePause = useCallback(() => {
    isPausedRef.current = true;
    setMusicPaused(true);
    cancelAnimation(progress);
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch (_) {}
    }
  }, [progress]);

  const resume = useCallback(() => {
    // Never resume under a sheet/modal — long-press/pan end can race swipe-up.
    if (interactionLockRef.current) return;
    if (!isPausedRef.current) return;
    isPausedRef.current = false;
    setMusicPaused(false);
    if (!currentStory) return;
    const remaining = Math.max(0, 1 - progress.value);
    const duration = Math.max(500, Math.round((currentStory.duration_ms || 5000) * remaining));
    progress.value = withTiming(1, {
      duration,
      easing: Easing.linear,
    }, (finished) => {
      if (finished) runOnJS(advance)();
    });
    if (videoRef.current) {
      try { videoRef.current.play(); } catch (_) {}
    }
  }, [currentStory, advance, progress]);

  const lockInteraction = useCallback(() => {
    interactionLockRef.current = true;
    forcePause();
  }, [forcePause]);

  const unlockInteraction = useCallback(() => {
    interactionLockRef.current = false;
  }, []);

  // ────────────────────────────────────────────────────────────────────
  // Navigation helpers
  // ────────────────────────────────────────────────────────────────────
  const goPrev = useCallback(() => {
    setStoryIdx((idx) => {
      if (idx > 0) return idx - 1;
      // beginning of this user – jump back to previous user (last story)
      setUserIdx((u) => {
        if (u > 0) {
          const prevIdx = u - 1;
          const t = groups[prevIdx]?.stories?.length || 1;
          // schedule storyIdx after userIdx update
          setTimeout(() => setStoryIdx(t - 1), 0);
          return prevIdx;
        }
        return u;
      });
      return idx;
    });
  }, [groups]);

  const goNext = useCallback(() => advance(), [advance]);

  const onSwipeUp = useCallback(() => {
    if (currentStory?.is_mine) {
      // Lock BEFORE any gesture-end resume can fire (long-press races pan).
      lockInteraction();
      setViewerSheetOpen(true);
      return;
    }
    try { resume(); } catch (_) {}
  }, [currentStory, lockInteraction, resume]);

  const finishClose = useCallback(() => {
    // Stories stack has no index screen — router.back() often throws GO_BACK.
    // Prefer dismiss (modal) then replace home. Guard against double-close.
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

  const unlockExit = useCallback(() => {
    animatingExitRef.current = false;
  }, []);

  const stopPlayback = useCallback(() => {
    isPausedRef.current = true;
    setMusicPaused(true);
    setViewerActive(false);
    cancelAnimation(progress);
    try { videoRef.current?.pause?.(); } catch (_) {}
  }, [progress]);

  const doClose = useCallback(() => {
    // Kill audio/video immediately — don't wait for exit animation / unmount.
    stopPlayback();
    // If a previous exit got stuck, force navigate out instead of no-op.
    if (animatingExitRef.current) {
      finishClose();
      return;
    }
    animatingExitRef.current = true;
    translateY.value = withTiming(WINDOW_H, { duration: 220 }, (finished) => {
      if (finished) runOnJS(finishClose)();
      else runOnJS(unlockExit)();
    });
  }, [finishClose, unlockExit, stopPlayback, translateY]);

  useEffect(() => {
    doCloseRef.current = doClose;
  }, [doClose]);

  // ────────────────────────────────────────────────────────────────────
  // Gestures
  // ────────────────────────────────────────────────────────────────────
  const gesturesEnabled = !viewerSheetOpen && !saveSheetOpen && !reportOpen && !shareOpen;

  const tapGesture = Gesture.Tap()
    .enabled(gesturesEnabled)
    .maxDuration(220)
    .onEnd((e) => {
      if (e.x < TAP_ZONE_WIDTH) {
        runOnJS(goPrev)();
      } else {
        runOnJS(goNext)();
      }
    });

  const longPressGesture = Gesture.LongPress()
    .enabled(gesturesEnabled)
    .minDuration(180)
    .onStart(() => { runOnJS(pause)(); })
    .onEnd(() => { runOnJS(resume)(); });

  const panGesture = Gesture.Pan()
    .enabled(gesturesEnabled)
    .activeOffsetY([-20, 20])
    .failOffsetX([-40, 40])
    .onStart(() => { runOnJS(pause)(); })
    .onUpdate((e) => {
      // Only follow the finger when dismissing downward.
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > SWIPE_DOWN_THRESHOLD || e.velocityY > 800) {
        runOnJS(doClose)();
      } else if (e.translationY < -SWIPE_UP_THRESHOLD || e.velocityY < -800) {
        runOnJS(onSwipeUp)();
        translateY.value = withTiming(0, { duration: 200 });
        // Stay paused if viewers sheet opened; resume only when not locked.
        runOnJS(resume)();
      } else {
        translateY.value = withTiming(0, { duration: 200 });
        runOnJS(resume)();
      }
    });

  // Exclusive: a swipe must not also fire long-press resume / tap advance.
  const composed = Gesture.Exclusive(panGesture, longPressGesture, tapGesture);

  // ────────────────────────────────────────────────────────────────────
  // Animated styles
  // ────────────────────────────────────────────────────────────────────
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: 1 - Math.min(translateY.value / 400, 0.6),
  }));

  const progressFillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  // ────────────────────────────────────────────────────────────────────
  // Reactions (not own stories)
  // ────────────────────────────────────────────────────────────────────
  const handleReact = useCallback(async (emoji) => {
    if (!currentStory || currentStory.is_mine || !token) return;
    const storyId = currentStory.id;
    const previous = reactionOverride[storyId] ?? currentStory.my_reaction ?? null;
    const previousCount = reactionCountOverride[storyId] ?? currentStory.reactions_count ?? 0;
    // Optimistic toggle behaviour: tapping the same emoji again removes it.
    const sameAsBefore = previous === emoji;
    const nextEmoji = sameAsBefore ? null : emoji;
    const nextCount = sameAsBefore
      ? Math.max(0, previousCount - 1)
      : (previous ? previousCount : previousCount + 1);

    setReactionOverride((m) => ({ ...m, [storyId]: nextEmoji }));
    setReactionCountOverride((m) => ({ ...m, [storyId]: nextCount }));

    try {
      if (sameAsBefore) {
        await API.removeStoryReaction(storyId, token);
      } else {
        await API.reactToStory(storyId, emoji, token);
      }
    } catch (e) {
      // Revert on failure.
      setReactionOverride((m) => ({ ...m, [storyId]: previous }));
      setReactionCountOverride((m) => ({ ...m, [storyId]: previousCount }));
    }
  }, [currentStory, token, reactionOverride, reactionCountOverride]);

  // ────────────────────────────────────────────────────────────────────
  // Reply (not own stories) – sends a chat message
  // ────────────────────────────────────────────────────────────────────
  const handleReply = useCallback(async (text) => {
    if (!currentStory || currentStory.is_mine || !token) return;
    await API.replyToStory(currentStory.id, text, token);
  }, [currentStory, token]);

  const onReplyFocus = useCallback(() => {
    setReplying(true);
    lockInteraction();
  }, [lockInteraction]);

  const onReplyBlur = useCallback(() => {
    setReplying(false);
    unlockInteraction();
    resume();
  }, [unlockInteraction, resume]);

  const handleMentionRepost = useCallback(async () => {
    if (!currentStory || !token || mentionRepostBusy || currentStory.is_mine) return;
    if (!currentStory.can_repost_as_mention) return;
    setMentionRepostBusy(true);
    pause();
    try {
      await API.repostStoryFromMention(currentStory.id, token);
      const data = await API.listStories(token);
      const g = Array.isArray(data?.groups) ? data.groups : [];
      setGroups(g);
      Alert.alert('Added to your story', 'It will appear on your profile like any other story.');
    } catch (e) {
      Alert.alert('Could not add', e?.message || 'Please try again.');
    } finally {
      setMentionRepostBusy(false);
      resume();
    }
  }, [currentStory, token, mentionRepostBusy, pause, resume]);

  const handleInteract = useCallback(async (overlayId, value) => {
    if (!currentStory || !token || currentStory.is_mine) return;
    pause();
    try {
      const data = await API.interactWithStory(currentStory.id, overlayId, value, token);
      const next = data?.interaction;
      if (!next) return;
      setGroups((prev) => prev.map((g, gi) => {
        if (gi !== userIdx) return g;
        return {
          ...g,
          stories: g.stories.map((s, si) => {
            if (si !== storyIdx) return s;
            const existing = Array.isArray(s.interactions) ? s.interactions : [];
            const idx = existing.findIndex((x) => x.overlay_id === overlayId);
            const interactions = idx >= 0
              ? existing.map((x, i) => (i === idx ? next : x))
              : [...existing, next];
            return { ...s, interactions };
          }),
        };
      }));
    } catch (e) {
      if (e?.response?.status !== 409) {
        Alert.alert('Could not send', e?.message || 'Try again.');
      }
    } finally {
      resume();
    }
  }, [currentStory, token, pause, resume, userIdx, storyIdx]);

  const confirmBlock = useCallback(() => {
    const targetId = currentGroup?.user?.id;
    if (!targetId || !token) {
      resume();
      return;
    }
    Alert.alert(
      'Block this person?',
      'You will no longer see each other\'s stories or be able to interact.',
      [
        { text: 'Cancel', style: 'cancel', onPress: resume },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await API.blockUser(targetId, token);
              const remaining = groups.filter((g, i) => i !== userIdx);
              if (remaining.length === 0) {
                doClose();
                return;
              }
              setGroups(remaining);
              setUserIdx((u) => Math.min(u, remaining.length - 1));
              setStoryIdx(0);
            } catch (e) {
              Alert.alert('Could not block', e?.message || 'Try again.');
              resume();
            }
          },
        },
      ],
    );
  }, [currentGroup, token, groups, userIdx, resume, doClose]);

  const openSafetyMenu = useCallback(() => {
    if (!currentStory || currentStory.is_mine) return;
    pause();
    Alert.alert(
      currentGroup?.user?.name || 'Story',
      'Report, block, or send this story in chat.',
      [
        { text: 'Report', onPress: () => { lockInteraction(); setReportOpen(true); } },
        { text: 'Block', style: 'destructive', onPress: confirmBlock },
        { text: 'Send in chat', onPress: () => { lockInteraction(); setShareOpen(true); } },
        { text: 'Cancel', style: 'cancel', onPress: resume },
      ],
    );
  }, [currentStory, currentGroup, pause, confirmBlock, resume, lockInteraction]);

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

  const handleSharePick = useCallback(async (picked) => {
    if (!picked?.id || !currentStory || !token) return;
    try {
      await API.shareStory(currentStory.id, picked.id, token);
      setShareOpen(false);
      Alert.alert('Sent', 'The story was shared in chat.');
      resume();
    } catch (e) {
      Alert.alert('Could not share', e?.message || 'This story may not be visible to them.');
    }
  }, [currentStory, token, resume]);

  // ────────────────────────────────────────────────────────────────────
  // Delete (own stories only)
  // ────────────────────────────────────────────────────────────────────
  const handleDelete = () => {
    if (!currentStory || !currentStory.is_mine) return;
    pause();
    Alert.alert(
      'Delete story?',
      'This will remove the story for everyone.',
      [
        { text: 'Cancel', style: 'cancel', onPress: resume },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await API.deleteStory(currentStory.id, token);
              // Remove locally and advance / close
              const newGroups = groups.map((g, gi) => {
                if (gi !== userIdx) return g;
                return { ...g, stories: g.stories.filter((s) => s.id !== currentStory.id) };
              }).filter((g) => g.stories.length > 0);
              if (newGroups.length === 0) {
                doClose();
                return;
              }
              setGroups(newGroups);
              setUserIdx((u) => Math.min(u, newGroups.length - 1));
              setStoryIdx(0);
            } catch (e) {
              Alert.alert('Error', e?.message || 'Could not delete.');
            }
          },
        },
      ],
    );
  };

  // ────────────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!currentStory) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <StatusBar style="light" />
        <Ionicons name="alert-circle-outline" size={48} color="rgba(255,255,255,0.5)" />
        <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 12, textAlign: 'center' }}>
          No stories to show right now.
        </Text>
        <Pressable
          onPress={finishClose}
          style={{ marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: '#ffc801' }}
        >
          <Text style={{ color: '#000', fontWeight: '800' }}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const ownerAvatar = resolveAvatarUrl(currentGroup?.user?.avatar);
  const isMine = !!currentStory.is_mine;
  const origVol = typeof musicOverlay?.original_volume === 'number' ? musicOverlay.original_volume : (musicOverlay ? 0 : 1);
  const videoIsMuted = muted || origVol <= 0.01;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" hidden={false} />
      {/*
        Gestures (tap prev/next, long-press pause, swipe-down close) are
        attached ONLY to the media layer. Header, reactions and reply sit in
        a sibling overlay so their touches never trigger story navigation.
      */}
      <Animated.View style={[{ flex: 1, backgroundColor: '#000' }, containerStyle]}>
        <GestureDetector gesture={composed}>
          <View style={{ flex: 1 }}>
            {/* Media layer — sole target for tap / pan / long-press */}
            <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
              {mediaFailed ? (
                <View style={{ alignItems: 'center', paddingHorizontal: 32 }}>
                  <Ionicons name="image-outline" size={48} color="rgba(255,255,255,0.45)" />
                  <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 12, textAlign: 'center' }}>
                    This photo could not be loaded.
                  </Text>
                </View>
              ) : (
                <StoryMediaFrame
                  key={currentStory.id}
                  story={currentStory}
                  style={{ width: WINDOW_W, height: WINDOW_H }}
                  videoProps={{
                    shouldPlay: !isPausedRef.current,
                    muted: videoIsMuted,
                    playerRef: videoRef,
                    onReady: () => setVideoReady(true),
                    onEnd: advance,
                    onError: () => setMediaFailed(true),
                  }}
                  onImageError={() => setMediaFailed(true)}
                />
              )}

              {currentStory.media_type === 'video' && !videoReady ? (
                <ActivityIndicator
                  size="large"
                  color="#fff"
                  style={{ position: 'absolute' }}
                />
              ) : null}

              <OverlayRenderer
                overlays={currentStory.overlays}
                musicAnimated={!musicPaused}
                interactions={currentStory.interactions}
                isMine={isMine}
                onInteract={handleInteract}
                onMentionPress={(o) => {
                  if (!o?.user_id) return;
                  pause();
                  doClose();
                  setTimeout(() => router.push(`/(tabs)/profile?userId=${o.user_id}`), 240);
                }}
              />
            </View>
          </View>
        </GestureDetector>

        {/* Chrome above the gesture layer — receives taps before navigation */}
        <View pointerEvents="box-none" style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
          {/* Top overlay: progress bars + header */}
          <View
            pointerEvents="box-none"
            style={{
              paddingTop: TOP_INSET,
              paddingHorizontal: 10,
            }}
          >
            {/* Progress bars */}
            <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 4 }}>
              {currentGroup.stories.map((_, i) => {
                const isPast = i < storyIdx;
                const isCurrent = i === storyIdx;
                return (
                  <View
                    key={i}
                    style={{
                      flex: 1, height: 2.5, borderRadius: 2,
                      backgroundColor: 'rgba(255,255,255,0.3)',
                      overflow: 'hidden',
                    }}
                  >
                    {isPast ? (
                      <View style={{ width: '100%', height: '100%', backgroundColor: '#fff' }} />
                    ) : isCurrent ? (
                      <Animated.View
                        style={[{ height: '100%', backgroundColor: '#fff' }, progressFillStyle]}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>

            {/* Header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              marginTop: 12, paddingHorizontal: 6,
            }}>
              <View style={{
                width: 32, height: 32, borderRadius: 16, overflow: 'hidden',
                backgroundColor: 'rgba(255,255,255,0.15)',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {ownerAvatar ? (
                  <Image source={{ uri: ownerAvatar }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {(currentGroup.user?.name || 'U').charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={{ color: '#fff', marginLeft: 10, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                {isMine ? 'Your story' : currentGroup.user?.name}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.65)', marginLeft: 8, fontSize: 12 }}>
                {timeAgo(currentStory.created_at)}
              </Text>

              {currentStory.audience === 'close_friends' ? (
                <View style={{
                  marginLeft: 8,
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 7, paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: '#ffc801',
                }}>
                  <Ionicons name="star" size={10} color="#000" />
                  <Text style={{ color: '#000', fontSize: 10, fontWeight: '800' }}>
                    Close friends
                  </Text>
                </View>
              ) : null}

              <View style={{ flex: 1 }} />

              {!isMine ? (
                <Pressable
                  onPress={openSafetyMenu}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Story options"
                  style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    alignItems: 'center', justifyContent: 'center',
                    marginRight: 6,
                  }}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
                </Pressable>
              ) : null}

              {currentStory.media_type === 'video' || !!musicOverlay ? (
                <Pressable
                  onPress={() => setMuted((m) => !m)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={muted ? 'Unmute' : 'Mute'}
                  style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    alignItems: 'center', justifyContent: 'center',
                    marginRight: 6,
                  }}
                >
                  <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
                </Pressable>
              ) : null}

              <Pressable
                onPress={doClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close stories"
                style={{
                  width: 36, height: 36, borderRadius: 18,
                  backgroundColor: 'rgba(0,0,0,0.35)',
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
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

          {/* Bottom: viewers / delete for own stories */}
          {isMine ? (
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute', bottom: 30, left: 0, right: 0,
                paddingHorizontal: 18,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <Pressable
                onPress={() => {
                  lockInteraction();
                  setViewerSheetOpen(true);
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${currentStory.views_count ?? 0} viewers`}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                  opacity: pressed ? 0.7 : 1,
                }]}
              >
                <Ionicons name="eye-outline" size={16} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                  {currentStory.views_count ?? 0}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginLeft: 4 }}>
                  Viewers
                </Text>
              </Pressable>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                  onPress={() => { lockInteraction(); setSaveSheetOpen(true); }}
                  hitSlop={10}
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="bookmark-outline" size={18} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={handleDelete}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Delete story"
                  style={{
                    width: 40, height: 40, borderRadius: 20,
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                </Pressable>
              </View>
            </View>
          ) : (
            // Engagement strip for other people's stories (reply + reactions)
            <View
              pointerEvents="box-none"
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                paddingBottom: Platform.OS === 'ios' ? 28 : 18,
              }}
            >
              {currentStory.can_repost_as_mention ? (
                <View style={{ alignItems: 'center', marginBottom: 10, paddingHorizontal: 20 }}>
                  <Pressable
                    onPress={handleMentionRepost}
                    disabled={mentionRepostBusy}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingHorizontal: 16,
                      paddingVertical: 10,
                      borderRadius: 999,
                      backgroundColor: pressed ? 'rgba(255,200,1,0.95)' : '#ffc801',
                      opacity: mentionRepostBusy ? 0.65 : 1,
                    })}
                  >
                    {mentionRepostBusy ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Ionicons name="repeat" size={18} color="#000" />
                    )}
                    <Text style={{ color: '#000', fontWeight: '800', fontSize: 14 }}>
                      Add to your story
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              <EmojiReactionRow
                currentReaction={
                  reactionOverride[currentStory.id] !== undefined
                    ? reactionOverride[currentStory.id]
                    : currentStory.my_reaction
                }
                onReact={handleReact}
              />
              <View style={{ height: 8 }} />
              <StoryReplyInput
                ownerName={currentGroup.user?.name?.split(' ')?.[0]}
                onSubmit={handleReply}
                onFocus={onReplyFocus}
                onBlur={onReplyBlur}
              />
            </View>
          )}
        </View>
      </Animated.View>

      {/* Viewer sheet (own stories) */}
      <ViewerListSheet
        visible={viewerSheetOpen}
        storyId={isMine ? currentStory?.id : null}
        onClose={() => {
          setViewerSheetOpen(false);
          unlockInteraction();
          resume();
        }}
        onPause={lockInteraction}
      />

      {/* Save-to-Highlight sheet (own stories) */}
      <SaveToHighlightSheet
        visible={saveSheetOpen}
        storyId={isMine ? currentStory?.id : null}
        ownerId={user?.id}
        onClose={() => {
          setSaveSheetOpen(false);
          unlockInteraction();
          resume();
        }}
        onSaved={() => {
          setSaveSheetOpen(false);
          unlockInteraction();
          resume();
        }}
      />

      <ReportReasonModal
        visible={reportOpen}
        onClose={() => {
          setReportOpen(false);
          unlockInteraction();
          resume();
        }}
        onSubmit={handleReport}
        submitting={reportBusy}
        title="Report story"
        isDark
      />

      <UserPickerSheet
        visible={shareOpen}
        title="Send in chat"
        onClose={() => {
          setShareOpen(false);
          unlockInteraction();
          resume();
        }}
        onPick={handleSharePick}
      />
    </GestureHandlerRootView>
  );
}

function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!t || isNaN(t)) return '';
  const diff = Math.max(0, Date.now() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}
