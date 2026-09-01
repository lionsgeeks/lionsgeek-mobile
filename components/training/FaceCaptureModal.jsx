import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  Pressable,
  Image,
  Linking,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import Skeleton from '@/components/ui/Skeleton';
import Button from '@/components/ui/Button';
import { Colors } from '@/constants/Colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const OVAL_WIDTH = 260;
const OVAL_HEIGHT = 320;

/**
 * Full-screen face capture for attendance check-in.
 * Uses expo-camera CameraView only — never image picker / gallery.
 *
 * @param {{
 *   visible: boolean,
 *   onCapture: (photoUri: string) => void,
 *   onCancel: () => void,
 *   errorMessage?: string | null,
 * }} props
 */
export default function FaceCaptureModal({
  visible,
  onCapture,
  onCancel,
  errorMessage = null,
}) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [qualityHint, setQualityHint] = useState(null);

  const borderOpacity = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      setCapturedUri(null);
      setCapturing(false);
      setQualityHint(null);
      cancelAnimation(borderOpacity);
      borderOpacity.value = 1;
      return undefined;
    }

    if (permission && !permission.granted && permission.canAskAgain !== false) {
      requestPermission();
    }

    return undefined;
  }, [visible, permission, requestPermission, borderOpacity]);

  useEffect(() => {
    if (!visible || capturedUri || !permission?.granted) {
      setQualityHint(null);
      cancelAnimation(borderOpacity);
      borderOpacity.value = 1;
      return undefined;
    }

    const timer = setTimeout(() => {
      setQualityHint('Hold still — auto-capturing');
      borderOpacity.value = withRepeat(
        withTiming(0.5, { duration: 900 }),
        -1,
        true,
      );
    }, 1500);

    return () => {
      clearTimeout(timer);
      cancelAnimation(borderOpacity);
      borderOpacity.value = 1;
    };
  }, [visible, capturedUri, permission?.granted, borderOpacity]);

  const ovalAnimatedStyle = useAnimatedStyle(() => ({
    opacity: borderOpacity.value,
  }));

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing || capturedUri) return;

    setCapturing(true);
    setQualityHint(null);
    cancelAnimation(borderOpacity);
    borderOpacity.value = 1;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: false,
        skipProcessing: false,
      });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
      }
    } catch (error) {
      console.error('[FaceCapture] takePictureAsync error:', error);
    } finally {
      setCapturing(false);
    }
  }, [capturing, capturedUri, borderOpacity]);

  const handleRetake = useCallback(() => {
    setCapturedUri(null);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!capturedUri) return;
    onCapture(capturedUri);
  }, [capturedUri, onCapture]);

  const renderPermissionLoading = () => (
    <View style={styles.centered}>
      <Skeleton width={200} height={20} borderRadius={10} isDark />
      <View style={{ height: 16 }} />
      <Skeleton width={260} height={14} borderRadius={8} isDark />
      <View style={{ height: 12 }} />
      <Skeleton width={180} height={14} borderRadius={8} isDark />
    </View>
  );

  const renderPermissionDenied = () => (
    <View style={styles.centered}>
      <Ionicons name="camera-outline" size={64} color="#ffc801" />
      <Text style={styles.deniedTitle}>Camera access needed</Text>
      <Text style={styles.deniedBody}>
        To mark attendance, LionsGeek needs your camera. Enable it in Settings.
      </Text>
      <Pressable
        style={({ pressed }) => [styles.settingsCta, pressed && styles.pressed]}
        onPress={() => Linking.openSettings()}
        accessibilityRole="button"
        accessibilityLabel="Open Settings"
      >
        <Text style={styles.settingsCtaText}>Open Settings</Text>
      </Pressable>
      <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Cancel">
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable
        style={styles.headerBack}
        onPress={onCancel}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Cancel face capture"
      >
        <Ionicons name="chevron-back" size={22} color="#fafafa" />
      </Pressable>
      <Text style={styles.headerTitle}>Mark attendance</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  const renderCamera = () => (
    <View style={styles.flex}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFillObject}
        facing="front"
        active={visible && !capturedUri}
      />

      {renderHeader()}

      <View style={styles.ovalWrap} pointerEvents="none">
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMessage}</Text>
            <Text style={styles.errorBannerSub}>
              No worries — better light usually does it.
            </Text>
          </View>
        ) : null}

        <Animated.View style={[styles.oval, ovalAnimatedStyle]} />

        {qualityHint ? (
          <View style={styles.qualityHint}>
            <Text style={styles.qualityHintText}>{qualityHint}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.bottomBar, { bottom: insets.bottom + 40 }]}>
        <Text style={styles.instruction}>Look at the camera</Text>
        <Pressable
          style={({ pressed }) => [
            styles.captureOuter,
            pressed && styles.capturePressed,
          ]}
          onPress={handleCapture}
          disabled={capturing}
          accessibilityRole="button"
          accessibilityLabel="Capture photo"
        >
          <View style={styles.captureInner}>
            {capturing ? (
              <ActivityIndicator color="#1a1400" />
            ) : (
              <Ionicons name="camera" size={28} color="#1a1400" />
            )}
          </View>
        </Pressable>
      </View>
    </View>
  );

  const renderPreview = () => (
    <View style={styles.flex}>
      <Image
        source={{ uri: capturedUri }}
        style={styles.previewImage}
        resizeMode="cover"
      />
      <View style={styles.previewOverlay} />
      {renderHeader()}

      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>Looks good?</Text>
        <Text style={styles.previewSub}>
          This is the photo we'll use to recognise you.
        </Text>
        <View className="flex-row items-center gap-3">
          <Button
            variant="outline"
            className="flex-1 rounded-2xl border-white/25"
            onPress={handleRetake}
          >
            Retake
          </Button>
          <Button
            variant="default"
            className="flex-1 rounded-2xl"
            onPress={handleConfirm}
          >
            Looks good — use this
          </Button>
        </View>
      </View>
    </View>
  );

  let body = null;
  if (!permission) {
    body = renderPermissionLoading();
  } else if (!permission.granted) {
    body = renderPermissionDenied();
  } else if (capturedUri) {
    body = renderPreview();
  } else {
    body = renderCamera();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <View style={styles.root}>{body}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.dark,
  },
  flex: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    backgroundColor: Colors.dark,
  },
  deniedTitle: {
    marginTop: 20,
    fontSize: 20,
    fontWeight: '600',
    color: '#fafafa',
    textAlign: 'center',
  },
  deniedBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(250,250,250,0.65)',
    textAlign: 'center',
  },
  settingsCta: {
    marginTop: 28,
    backgroundColor: '#ffc801',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  settingsCtaText: {
    color: '#1a1400',
    fontWeight: '700',
    fontSize: 15,
  },
  cancelText: {
    marginTop: 16,
    color: 'rgba(250,250,250,0.65)',
    fontSize: 15,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'transparent',
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fafafa',
    fontSize: 17,
    fontWeight: '600',
  },
  ovalWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oval: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: 130,
    borderWidth: 3,
    borderColor: '#ffc801',
    backgroundColor: 'transparent',
    shadowColor: '#ffc801',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  qualityHint: {
    marginTop: 16,
    backgroundColor: 'rgba(255,200,1,0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,200,1,0.3)',
  },
  qualityHintText: {
    color: '#ffc801',
    fontSize: 13,
    fontWeight: '500',
  },
  errorBanner: {
    position: 'absolute',
    top: '50%',
    marginTop: -(OVAL_HEIGHT / 2 + 72),
    width: SCREEN_WIDTH - 48,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  errorBannerText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '500',
  },
  errorBannerSub: {
    marginTop: 3,
    color: 'rgba(250,250,250,0.6)',
    fontSize: 12,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 20,
  },
  instruction: {
    color: '#fafafa',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  captureOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ffc801',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capturePressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  previewCard: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -120,
    width: SCREEN_WIDTH - 48,
    backgroundColor: 'rgba(23,23,23,0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  previewLabel: {
    color: '#fafafa',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  previewSub: {
    color: 'rgba(250,250,250,0.65)',
    fontSize: 13,
    marginBottom: 24,
    lineHeight: 18,
  },
});
