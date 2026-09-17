import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Platform,
  StatusBar as RNStatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

const FLASH_CYCLE = ['off', 'on', 'auto'];

/**
 * In-app story camera. Returns one media object or a boomerang frame list.
 */
export default function CameraCapture({ onCapture, onCancel, onOpenGallery }) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState('back');
  const [flash, setFlash] = useState('off');
  const [zoom, setZoom] = useState(0);
  const [mode, setMode] = useState('photo'); // photo | video | boomerang
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [timerSec, setTimerSec] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [boomerangFrames, setBoomerangFrames] = useState([]);
  const [focusPoint, setFocusPoint] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain !== false) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        skipProcessing: Platform.OS === 'android',
      });
      if (photo?.uri) {
        onCapture?.({
          uri: photo.uri,
          type: 'image',
          width: photo.width,
          height: photo.height,
          durationMs: 5000,
          mimeType: 'image/jpeg',
        });
      }
    } catch (_) {
    } finally {
      setBusy(false);
    }
  }, [busy, onCapture]);

  const captureBoomerang = useCallback(async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    const frames = [];
    try {
      for (let i = 0; i < 8; i += 1) {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.55,
          skipProcessing: true,
        });
        if (photo?.uri) frames.push(photo.uri);
        await new Promise((r) => setTimeout(r, 90));
      }
      if (frames.length >= 3) {
        onCapture?.({
          type: 'boomerang',
          frames,
          uri: frames[0],
          durationMs: 4000,
          mimeType: 'image/jpeg',
        });
      }
    } catch (_) {
    } finally {
      setBusy(false);
      setBoomerangFrames(frames);
    }
  }, [busy, onCapture]);

  const startVideo = useCallback(async () => {
    if (!cameraRef.current || recording || busy) return;
    if (!micPermission?.granted) {
      const mic = await requestMicPermission();
      if (!mic?.granted) return;
    }
    setRecording(true);
    try {
      cameraRef.current.recordAsync({ maxDuration: 60 }).then((video) => {
        setRecording(false);
        if (video?.uri) {
          onCapture?.({
            uri: video.uri,
            type: 'video',
            durationMs: 15000,
            mimeType: 'video/mp4',
          });
        }
      }).catch(() => setRecording(false));
    } catch (_) {
      setRecording(false);
    }
  }, [recording, busy, micPermission, requestMicPermission, onCapture]);

  const stopVideo = useCallback(() => {
    try { cameraRef.current?.stopRecording?.(); } catch (_) {}
  }, []);

  const runWithTimer = useCallback((action) => {
    if (!timerSec) {
      action();
      return;
    }
    setCountdown(timerSec);
    let left = timerSec;
    timerRef.current = setInterval(() => {
      left -= 1;
      setCountdown(left);
      if (left <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setCountdown(0);
        action();
      }
    }, 1000);
  }, [timerSec]);

  const onShutter = useCallback(() => {
    if (recording) {
      stopVideo();
      return;
    }
    if (mode === 'video') runWithTimer(startVideo);
    else if (mode === 'boomerang') runWithTimer(captureBoomerang);
    else runWithTimer(takePhoto);
  }, [recording, mode, runWithTimer, startVideo, captureBoomerang, takePhoto, stopVideo]);

  const pinch = Gesture.Pinch().onUpdate((e) => {
    const next = Math.max(0, Math.min(0.7, (e.scale - 1) * 0.25 + zoom));
    runOnJS(setZoom)(next);
  });

  const showFocus = useCallback((x, y) => {
    setFocusPoint({ x, y });
    setTimeout(() => setFocusPoint(null), 700);
  }, []);

  const tapFocus = Gesture.Tap().onEnd((e) => {
    runOnJS(showFocus)(e.x, e.y);
  });

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  }
  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: '#fff', textAlign: 'center', marginBottom: 16 }}>Camera access is needed to capture a story.</Text>
        <Pressable onPress={requestPermission} style={{ backgroundColor: '#ffc801', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 }}>
          <Text style={{ color: '#000', fontWeight: '800' }}>Allow camera</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={{ marginTop: 16 }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)' }}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  const top = (Platform.OS === 'ios' ? 54 : RNStatusBar.currentHeight ?? 24) + 6;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" />
      <GestureDetector gesture={Gesture.Simultaneous(pinch, tapFocus)}>
        <CameraView
          ref={cameraRef}
          style={{ flex: 1 }}
          facing={facing}
          flash={flash}
          zoom={zoom}
          mode={mode === 'video' ? 'video' : 'picture'}
          mute={false}
          autofocus="on"
        />
      </GestureDetector>
      {focusPoint ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: focusPoint.x - 28,
            top: focusPoint.y - 28,
            width: 56,
            height: 56,
            borderWidth: 1.5,
            borderColor: '#ffc801',
            borderRadius: 8,
          }}
        />
      ) : null}

      {countdown > 0 ? (
        <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#ffc801', fontSize: 72, fontWeight: '900' }}>{countdown}</Text>
        </View>
      ) : null}

      <View style={{ position: 'absolute', top, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable onPress={onCancel} style={roundBtn} accessibilityLabel="Close camera">
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => setFlash((f) => FLASH_CYCLE[(FLASH_CYCLE.indexOf(f) + 1) % 3])} style={roundBtn}>
            <Ionicons name={flash === 'off' ? 'flash-off' : flash === 'auto' ? 'flash' : 'flash'} size={20} color={flash === 'off' ? '#fff' : '#ffc801'} />
          </Pressable>
          <Pressable onPress={() => setTimerSec((t) => (t === 0 ? 3 : t === 3 ? 10 : 0))} style={roundBtn}>
            <Text style={{ color: timerSec ? '#ffc801' : '#fff', fontWeight: '800', fontSize: 12 }}>{timerSec ? `${timerSec}s` : 'Off'}</Text>
          </Pressable>
          <Pressable onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))} style={roundBtn}>
            <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={{ position: 'absolute', bottom: 36, left: 0, right: 0, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 18, marginBottom: 18 }}>
          {['photo', 'video', 'boomerang'].map((m) => (
            <Pressable key={m} onPress={() => setMode(m)}>
              <Text style={{ color: mode === m ? '#ffc801' : 'rgba(255,255,255,0.65)', fontWeight: '800', textTransform: 'capitalize' }}>{m}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 28 }}>
          <Pressable onPress={onOpenGallery} style={roundBtn}>
            <Ionicons name="images-outline" size={22} color="#fff" />
          </Pressable>
          <Pressable
            onPress={onShutter}
            disabled={busy}
            style={{
              width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#fff',
              backgroundColor: recording ? '#ef4444' : mode === 'video' ? '#ffc801' : '#fff',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            {busy ? <ActivityIndicator color="#000" /> : (
              <View style={{
                width: recording ? 22 : 58,
                height: recording ? 22 : 58,
                borderRadius: recording ? 4 : 29,
                backgroundColor: recording ? '#fff' : (mode === 'video' ? '#000' : '#ffc801'),
              }} />
            )}
          </Pressable>
          <View style={{ width: 44 }} />
        </View>
        <Text style={{ color: 'rgba(255,255,255,0.55)', marginTop: 10, fontSize: 12 }}>
          {mode === 'video' ? (recording ? 'Tap to stop' : 'Tap to record') : mode === 'boomerang' ? 'Burst loop' : 'Tap for photo'}
        </Text>
      </View>
    </View>
  );
}

const roundBtn = {
  width: 44, height: 44, borderRadius: 22,
  backgroundColor: 'rgba(0,0,0,0.45)',
  alignItems: 'center', justifyContent: 'center',
};
