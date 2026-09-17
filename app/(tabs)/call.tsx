import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  BackHandler,
  Alert,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  StyleSheet,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { useCallContext } from '@/context/CallContext';
import { useAppContext } from '@/context';
import API from '@/api';
import useAgoraCall, { getAgoraAppId, isAgoraNativeAvailable } from '@/hooks/useAgoraCall';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

async function ensureCallPermissions(isVideo: boolean): Promise<boolean> {
  if (Platform.OS === 'android') {
    const wants = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
    if (isVideo) wants.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    const results = await PermissionsAndroid.requestMultiple(wants);
    const micOk = results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
    const camOk = !isVideo
      || results[PermissionsAndroid.PERMISSIONS.CAMERA] === PermissionsAndroid.RESULTS.GRANTED;
    return micOk && camOk;
  }

  const mic = await requestRecordingPermissionsAsync();
  if (!mic.granted) return false;
  // iOS camera permission is prompted by Agora / system when enabling video.
  return true;
}

function statusLabel(state: string): string {
  switch (state) {
    case 'connecting':
      return 'Connecting...';
    case 'reconnecting':
      return 'Reconnecting...';
    case 'connected':
      return 'Connected';
    case 'failed':
      return 'Call failed';
    case 'ended':
      return 'Call ended';
    default:
      return 'Calling...';
  }
}

export default function CallScreen() {
  const router = useRouter();
  const { user } = useAppContext();
  const { activeCall, end, clearActiveCall } = useCallContext();
  const [seconds, setSeconds] = useState(0);
  const [permReady, setPermReady] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);
  const endingRef = useRef(false);

  const isVideo = activeCall?.type === 'video';
  const appId = activeCall?.appId || getAgoraAppId();
  const peer = activeCall?.isCaller ? activeCall?.callee : activeCall?.caller;
  const peerName = peer?.name || 'User';
  const peerAvatar = peer?.image || peer?.avatar
    ? `${API.APP_URL}/storage/img/profile/${peer.image || peer.avatar}`
    : null;

  useEffect(() => {
    if (!activeCall) {
      const t = setTimeout(() => router.replace('/(tabs)/home'), 300);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [activeCall, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeCall) return;
      try {
        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        });
      } catch (_) {}
      const ok = await ensureCallPermissions(!!isVideo);
      if (cancelled) return;
      if (!ok) {
        setPermError(isVideo ? 'Camera and microphone permission required' : 'Microphone permission required');
        setPermReady(false);
        return;
      }
      if (!isAgoraNativeAvailable()) {
        setPermError('Voice and video calls require a development build (not Expo Go).');
        setPermReady(false);
        return;
      }
      if (!appId) {
        setPermError('Agora App ID is not configured.');
        setPermReady(false);
        return;
      }
      setPermReady(true);
    })();
    return () => { cancelled = true; };
  }, [activeCall, isVideo, appId]);

  const hangUp = useCallback(async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    try {
      await end?.();
    } catch (e) {
      if (__DEV__) {
        console.warn('[Call] hangUp endCall error:', e?.response?.data || e?.message || e);
      }
    } finally {
      clearActiveCall?.();
      router.replace('/(tabs)/home');
    }
  }, [end, clearActiveCall, router]);

  // If the call screen unmounts without an explicit hang-up (nav away),
  // still close the server-side call so it cannot block future initiates.
  useEffect(() => {
    return () => {
      if (endingRef.current) return;
      endingRef.current = true;
      Promise.resolve()
        .then(() => end?.())
        .catch((e) => {
          if (__DEV__) {
            console.warn('[Call] unmount endCall error:', e?.response?.data || e?.message || e);
          }
        })
        .finally(() => clearActiveCall?.());
    };
  }, [end, clearActiveCall]);

  const onRemoteLeft = useCallback(() => {
    hangUp();
  }, [hangUp]);

  const onError = useCallback((err: Error) => {
    Alert.alert('Call', err?.message || 'Call failed', [
      { text: 'OK', onPress: () => hangUp() },
    ]);
  }, [hangUp]);

  const agora = useAgoraCall({
    appId,
    token: activeCall?.token,
    channelName: activeCall?.channelName,
    userAccount: user?.id,
    isVideo: !!isVideo,
    enabled: !!activeCall && permReady && !permError,
    onRemoteLeft,
    onError,
  });

  useEffect(() => {
    if (!agora.joined) return undefined;
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [agora.joined]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      hangUp();
      return true;
    });
    return () => sub.remove();
  }, [hangUp]);

  const RtcSurfaceView = useMemo(() => {
    if (!isAgoraNativeAvailable()) return null;
    try {
      // eslint-disable-next-line global-require
      return require('react-native-agora').RtcSurfaceView;
    } catch (_) {
      return null;
    }
  }, []);

  if (!activeCall) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (permError) {
    return (
      <View style={styles.center}>
        <Ionicons name="warning-outline" size={40} color="#ffc801" />
        <Text style={styles.errorText}>{permError}</Text>
        <TouchableOpacity style={styles.endBtn} onPress={hangUp}>
          <Text style={styles.endBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {isVideo && RtcSurfaceView ? (
        <View style={StyleSheet.absoluteFill}>
          {agora.remoteUid != null ? (
            <RtcSurfaceView
              style={StyleSheet.absoluteFill}
              canvas={{ uid: agora.remoteUid }}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <Text style={styles.status}>{statusLabel(agora.connectionState)}</Text>
              <Text style={styles.name}>{peerName}</Text>
            </View>
          )}
          {agora.videoEnabled ? (
            <View style={styles.localPreview}>
              <RtcSurfaceView
                style={StyleSheet.absoluteFill}
                canvas={{ uid: 0 }}
                zOrderMediaOverlay
              />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.audioWrap}>
          {peerAvatar ? (
            <Image source={{ uri: peerAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={56} color="rgba(255,255,255,0.7)" />
            </View>
          )}
          <Text style={styles.name}>{peerName}</Text>
          <Text style={styles.status}>
            {agora.joined ? formatDuration(seconds) : statusLabel(agora.connectionState)}
          </Text>
          <Text style={styles.subStatus}>
            {isVideo ? 'Video call' : 'Audio call'}
            {agora.remoteUid != null ? ' · Connected' : ''}
          </Text>
        </View>
      )}

      {isVideo && agora.joined ? (
        <View style={styles.videoTopMeta}>
          <Text style={styles.name}>{peerName}</Text>
          <Text style={styles.status}>{formatDuration(seconds)}</Text>
        </View>
      ) : null}

      <View style={styles.controls}>
        <TouchableOpacity style={styles.ctrlBtn} onPress={agora.toggleMute}>
          <Ionicons name={agora.muted ? 'mic-off' : 'mic'} size={26} color="#fff" />
          <Text style={styles.ctrlLabel}>{agora.muted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ctrlBtn} onPress={agora.toggleSpeaker}>
          <Ionicons name={agora.speakerOn ? 'volume-high' : 'volume-mute'} size={26} color="#fff" />
          <Text style={styles.ctrlLabel}>Speaker</Text>
        </TouchableOpacity>

        {isVideo ? (
          <>
            <TouchableOpacity style={styles.ctrlBtn} onPress={agora.toggleCamera}>
              <Ionicons name={agora.videoEnabled ? 'videocam' : 'videocam-off'} size={26} color="#fff" />
              <Text style={styles.ctrlLabel}>{agora.videoEnabled ? 'Camera on' : 'Camera off'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctrlBtn} onPress={agora.switchCamera}>
              <Ionicons name="camera-reverse" size={26} color="#fff" />
              <Text style={styles.ctrlLabel}>Switch</Text>
            </TouchableOpacity>
          </>
        ) : null}

        <TouchableOpacity style={[styles.ctrlBtn, styles.hangup]} onPress={hangUp}>
          <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          <Text style={styles.ctrlLabel}>End call</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  audioWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  avatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.12)' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  name: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  status: { color: 'rgba(255,255,255,0.7)', fontSize: 15, letterSpacing: 0.5 },
  subStatus: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 6 },
  errorText: { color: '#fff', textAlign: 'center', marginTop: 12, marginBottom: 20, fontSize: 15 },
  endBtn: { backgroundColor: '#ffc801', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  endBtnText: { color: '#000', fontWeight: '800' },
  localPreview: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 110,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: '#111',
  },
  videoTopMeta: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 140,
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 18,
    paddingHorizontal: 16,
  },
  ctrlBtn: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctrlLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },
  hangup: {
    backgroundColor: '#e53935',
    width: 72,
    height: 72,
    borderRadius: 36,
    paddingTop: 8,
  },
});
