import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const AGORA_APP_ID =
  process.env.EXPO_PUBLIC_AGORA_APP_ID ||
  Constants.expoConfig?.extra?.agoraAppId ||
  '';

export function isAgoraNativeAvailable() {
  // Expo Go cannot load native Agora modules.
  if (Constants.appOwnership === 'expo') return false;
  try {
    // eslint-disable-next-line global-require
    require('react-native-agora');
    return true;
  } catch (_) {
    return false;
  }
}

export function getAgoraAppId() {
  return AGORA_APP_ID;
}

/**
 * Manage a single Agora RTC session for 1:1 audio/video.
 * Token + channel come from Laravel; certificate never lives on device.
 */
export default function useAgoraCall({
  appId,
  token,
  channelName,
  userAccount,
  isVideo = false,
  enabled = true,
  onRemoteJoined,
  onRemoteLeft,
  onError,
  onConnected,
}) {
  const engineRef = useRef(null);
  const [joined, setJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState(null);
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(!!isVideo);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [connectionState, setConnectionState] = useState('idle');
  const [frontCamera, setFrontCamera] = useState(true);
  const cleanedRef = useRef(false);

  const cleanup = useCallback(async () => {
    if (cleanedRef.current) return;
    cleanedRef.current = true;
    const engine = engineRef.current;
    engineRef.current = null;
    if (!engine) return;
    try {
      engine.leaveChannel();
    } catch (_) {}
    try {
      engine.stopPreview();
    } catch (_) {}
    try {
      engine.enableLocalVideo(false);
    } catch (_) {}
    try {
      engine.enableLocalAudio(false);
    } catch (_) {}
    try {
      engine.release();
    } catch (_) {}
    setJoined(false);
    setRemoteUid(null);
    setConnectionState('ended');
  }, []);

  useEffect(() => {
    cleanedRef.current = false;
    if (!enabled || !appId || !token || !channelName || !userAccount) {
      return undefined;
    }
    if (!isAgoraNativeAvailable()) {
      onError?.(new Error('Agora requires a development build (not Expo Go).'));
      setConnectionState('failed');
      return undefined;
    }

    let cancelled = false;
    setConnectionState('connecting');

    (async () => {
      try {
        // eslint-disable-next-line global-require
        const Agora = require('react-native-agora');
        const {
          createAgoraRtcEngine,
          ChannelProfileType,
          ClientRoleType,
        } = Agora;

        const engine = createAgoraRtcEngine();
        engineRef.current = engine;
        engine.initialize({
          appId,
          channelProfile: ChannelProfileType.ChannelProfileCommunication,
        });

        engine.registerEventHandler({
          onJoinChannelSuccess: () => {
            if (cancelled) return;
            setJoined(true);
            setConnectionState('connected');
            onConnected?.();
          },
          onUserJoined: (_connection, uid) => {
            if (cancelled) return;
            setRemoteUid(uid);
            onRemoteJoined?.(uid);
          },
          onUserOffline: (_connection, uid) => {
            if (cancelled) return;
            setRemoteUid((prev) => (prev === uid ? null : prev));
            onRemoteLeft?.(uid);
          },
          onError: (err) => {
            if (cancelled) return;
            setConnectionState('failed');
            onError?.(new Error(`Agora error ${err}`));
          },
          onConnectionStateChanged: (_connection, state) => {
            if (cancelled) return;
            // 3 = Connecting, 4 = Connected, 5 = Reconnecting, 6 = Failed
            if (state === 5) setConnectionState('reconnecting');
            else if (state === 4) setConnectionState('connected');
            else if (state === 6) setConnectionState('failed');
          },
        });

        engine.enableAudio();
        engine.setDefaultAudioRouteToSpeakerphone(true);

        if (isVideo) {
          engine.enableVideo();
          engine.enableLocalVideo(true);
          engine.startPreview();
          setVideoEnabled(true);
        } else {
          engine.enableLocalVideo(false);
          setVideoEnabled(false);
        }

        const options = {
          clientRoleType: ClientRoleType.ClientRoleBroadcaster,
          publishMicrophoneTrack: true,
          publishCameraTrack: !!isVideo,
          autoSubscribeAudio: true,
          autoSubscribeVideo: !!isVideo,
        };

        // Token was minted with string userAccount = user id.
        engine.joinChannelWithUserAccount(token, channelName, String(userAccount), options);
      } catch (e) {
        if (!cancelled) {
          setConnectionState('failed');
          onError?.(e);
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [
    enabled,
    appId,
    token,
    channelName,
    userAccount,
    isVideo,
    cleanup,
    onConnected,
    onError,
    onRemoteJoined,
    onRemoteLeft,
  ]);

  const toggleMute = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = !muted;
    try {
      engine.muteLocalAudioStream(next);
      setMuted(next);
    } catch (_) {}
  }, [muted]);

  const toggleSpeaker = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = !speakerOn;
    try {
      engine.setEnableSpeakerphone(next);
      setSpeakerOn(next);
    } catch (_) {}
  }, [speakerOn]);

  const toggleCamera = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !isVideo) return;
    const next = !videoEnabled;
    try {
      engine.muteLocalVideoStream(!next);
      engine.enableLocalVideo(next);
      setVideoEnabled(next);
    } catch (_) {}
  }, [isVideo, videoEnabled]);

  const switchCamera = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || !isVideo) return;
    try {
      engine.switchCamera();
      setFrontCamera((v) => !v);
    } catch (_) {}
  }, [isVideo]);

  return {
    joined,
    remoteUid,
    muted,
    videoEnabled,
    speakerOn,
    frontCamera,
    connectionState,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
    switchCamera,
    cleanup,
    platform: Platform.OS,
  };
}
