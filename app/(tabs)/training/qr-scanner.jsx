import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter, router as routerDirect } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useAppContext } from '@/context';
import API from '@/api';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import Skeleton from '@/components/ui/Skeleton';
import FaceCaptureModal from '@/components/training/FaceCaptureModal';
import {
  CHECKIN_RESTRICTED_FALLBACK,
  CHECKIN_UNAVAILABLE_BANNER,
  CHECKIN_UNAVAILABLE_MESSAGE,
  CHECKIN_UNAVAILABLE_TITLE,
  NETWORK_RESTRICTED_FALLBACK,
  checkAttendanceNetwork,
  formatCheckInSuccessMessage,
  getApiMessage,
  isFaceNotRecognizedError,
  isStaffUser,
  submitCheckIn,
} from '@/components/training/attendanceCheckIn';

export default function QRScanner() {
  const { id, trainingId } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const routerHook = useRouter();
  const { token, user } = useAppContext();
  const scanLockRef = useRef(false);
  const pendingCheckInRef = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [training, setTraining] = useState(null);
  const [networkStatus, setNetworkStatus] = useState(null);
  const [networkMessage, setNetworkMessage] = useState('');
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [faceError, setFaceError] = useState(null);
  const [pendingFormationId, setPendingFormationId] = useState(null);
  const [isPaused, setIsPaused] = useState(false);

  const navigateToTraining = useCallback(() => {
    try {
      const routerToUse = routerHook || routerDirect;
      if (routerToUse) {
        if (typeof routerToUse.push === 'function') {
          routerToUse.push('/(tabs)/training');
        } else if (typeof routerToUse.replace === 'function') {
          routerToUse.replace('/(tabs)/training');
        } else {
          console.warn('Router navigation methods not available');
        }
      } else {
        console.warn('Router not available');
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [routerHook]);

  const resetScanner = useCallback(() => {
    setScanned(false);
    setProcessing(false);
    scanLockRef.current = false;
    setIsPaused(false);
    setShowFaceCapture(false);
    setFaceError(null);
    setPendingFormationId(null);
    pendingCheckInRef.current = null;
  }, []);

  const showAttendanceSuccess = useCallback((message) => {
    Alert.alert('Attendance Marked', message, [{ text: 'OK', onPress: navigateToTraining }]);
  }, [navigateToTraining]);

  const checkNetwork = useCallback(async () => {
    if (!token || isStaffUser(user)) {
      setNetworkStatus(null);
      setNetworkMessage('');
      return;
    }

    setNetworkStatus('checking');
    try {
      await checkAttendanceNetwork(token);
      setNetworkStatus('ok');
      setNetworkMessage('');
    } catch (err) {
      if (err?.response?.status === 403) {
        setNetworkStatus('restricted');
        setNetworkMessage(getApiMessage(err, NETWORK_RESTRICTED_FALLBACK));
      } else if (err?.response?.status === 503) {
        setNetworkStatus('unavailable');
        setNetworkMessage(CHECKIN_UNAVAILABLE_BANNER);
      } else {
        setNetworkStatus(null);
        setNetworkMessage('');
      }
    }
  }, [token, user]);

  const handleCheckInUnavailable = useCallback(() => {
    Alert.alert(
      CHECKIN_UNAVAILABLE_TITLE,
      CHECKIN_UNAVAILABLE_MESSAGE,
      [{ text: 'OK', onPress: resetScanner }],
    );
  }, [resetScanner]);

  const handleCheckInRestricted = useCallback((checkInError) => {
    const message = getApiMessage(checkInError, CHECKIN_RESTRICTED_FALLBACK);

    Alert.alert(
      'Cannot Check In',
      message,
      [
        { text: 'OK', onPress: resetScanner },
        {
          text: 'Try again',
          onPress: async () => {
            const pending = pendingCheckInRef.current;
            if (!pending || !token) {
              resetScanner();
              return;
            }

            try {
              await checkAttendanceNetwork(token);
              setNetworkStatus('ok');
              setNetworkMessage('');
              setFaceError(null);
              setIsPaused(true);
              setShowFaceCapture(true);
              setProcessing(false);
            } catch (retryError) {
              if (retryError?.response?.status === 403) {
                handleCheckInRestricted(retryError);
              } else if (retryError?.response?.status === 503) {
                handleCheckInUnavailable();
              } else {
                Alert.alert('Error', 'Failed to verify school wifi. Please try again.');
                resetScanner();
              }
            }
          },
        },
      ],
    );
  }, [token, resetScanner, handleCheckInUnavailable]);

  useFocusEffect(
    useCallback(() => {
      checkNetwork();
    }, [checkNetwork]),
  );

  const currentTrainingId = id || trainingId;

  useEffect(() => {
    const fetchTraining = async () => {
      if (!token || !currentTrainingId) return;
      try {
        const response = await API.getWithAuth(`mobile/trainings/${currentTrainingId}`, token);
        if (response?.data?.training) {
          setTraining(response.data.training);
        }
      } catch (error) {
        console.error('Error fetching training:', error);
      }
    };
    fetchTraining();
  }, [token, currentTrainingId]);

  const fetchTrainingById = async (requestedTrainingId) => {
    if (!token || !requestedTrainingId) return null;
    try {
      const response = await API.getWithAuth(`mobile/trainings/${requestedTrainingId}`, token);
      return response?.data?.training || null;
    } catch (error) {
      console.error('Error fetching training:', error);
      return null;
    }
  };

  const handleFaceCancel = useCallback(() => {
    setShowFaceCapture(false);
    setFaceError(null);
    setIsPaused(false);
    setPendingFormationId(null);
    pendingCheckInRef.current = null;
    resetScanner();
  }, [resetScanner]);

  const handleFaceCapture = useCallback(
    async (photoUri) => {
      const pending = pendingCheckInRef.current;
      if (!token || !pending) {
        handleFaceCancel();
        return;
      }

      setShowFaceCapture(false);
      setFaceError(null);
      setProcessing(true);

      try {
        const data = await submitCheckIn(token, {
          ...pending,
          photoUri,
        });
        pendingCheckInRef.current = null;
        setPendingFormationId(null);
        setIsPaused(false);
        setProcessing(false);
        showAttendanceSuccess(formatCheckInSuccessMessage(data));
      } catch (checkInError) {
        setProcessing(false);
        const status = checkInError?.response?.status;

        if (isFaceNotRecognizedError(checkInError)) {
          setFaceError("Hmm, we couldn't tell it was you.");
          setIsPaused(true);
          setShowFaceCapture(true);
          return;
        }
        if (status === 403) {
          handleCheckInRestricted(checkInError);
          return;
        }
        if (status === 503) {
          handleCheckInUnavailable();
          return;
        }
        if (status === 409) {
          pendingCheckInRef.current = null;
          setPendingFormationId(null);
          setIsPaused(false);
          Alert.alert(
            'Already Marked',
            getApiMessage(checkInError, 'You have already marked attendance for this slot.'),
            [{ text: 'OK', onPress: navigateToTraining }],
          );
          return;
        }
        if (status === 422) {
          pendingCheckInRef.current = null;
          setPendingFormationId(null);
          Alert.alert(
            'No Active Slot',
            getApiMessage(checkInError, 'There is no active attendance slot right now.'),
            [{ text: 'OK', onPress: resetScanner }],
          );
          return;
        }

        console.error('Face check-in error:', checkInError);
        Alert.alert('Error', 'Failed to mark attendance. Please try again.');
        resetScanner();
      }
    },
    [
      token,
      handleFaceCancel,
      showAttendanceSuccess,
      handleCheckInRestricted,
      handleCheckInUnavailable,
      navigateToTraining,
      resetScanner,
    ],
  );

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned || processing || scanLockRef.current || isPaused || showFaceCapture) return;

    scanLockRef.current = true;
    setScanned(true);
    setProcessing(true);

    try {
      const qrData = JSON.parse(data);

      if (!qrData.training_id || !qrData.date) {
        Alert.alert('Invalid QR Code', 'The QR code does not contain valid training information.');
        resetScanner();
        return;
      }

      if (currentTrainingId && parseInt(qrData.training_id) !== parseInt(currentTrainingId)) {
        Alert.alert('Invalid Training', 'This QR code is for a different training.');
        resetScanner();
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      if (qrData.date !== today) {
        Alert.alert('Expired QR Code', 'This QR code is not valid for today.');
        resetScanner();
        return;
      }

      if (!user || !user.id) {
        Alert.alert('Error', 'User information not available. Please log in again.');
        resetScanner();
        return;
      }

      const userId = user.id;
      const trainingIdFromQR = parseInt(qrData.training_id);

      let trainingData = training;
      if (!trainingData || trainingData.id !== trainingIdFromQR) {
        trainingData = await fetchTrainingById(trainingIdFromQR);
        if (trainingData) {
          setTraining(trainingData);
        }
      }

      if (!trainingData || !trainingData.users || !trainingData.users.some((u) => u.id === userId)) {
        Alert.alert('Not Enrolled', 'You are not enrolled in this training.');
        resetScanner();
        return;
      }

      const checkInPayload = {
        formation_id: trainingIdFromQR,
        attendance_day: qrData.date,
      };

      pendingCheckInRef.current = checkInPayload;
      setPendingFormationId(trainingIdFromQR);
      setProcessing(false);
      setIsPaused(true);
      setFaceError(null);
      setShowFaceCapture(true);
    } catch (error) {
      console.error('QR Scan Error:', error);
      Alert.alert('Error', 'Failed to process QR code. Please try again.');
      resetScanner();
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <View style={{ paddingHorizontal: 24, paddingTop: 120, alignItems: 'center' }}>
          <Skeleton width={240} height={18} borderRadius={12} isDark={isDark} />
          <View style={{ height: 14 }} />
          <Skeleton width={180} height={14} borderRadius={12} isDark={isDark} />
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer(isDark)}>
          <Ionicons name="camera-outline" size={64} color={Colors.alpha} />
          <Text style={styles.permissionTitle(isDark)}>Camera Permission Required</Text>
          <Text style={styles.permissionText(isDark)}>
            We need access to your camera to scan QR codes for attendance.
          </Text>
          <Pressable
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        active={!isPaused && !showFaceCapture}
        onBarcodeScanned={scanned || processing || isPaused || showFaceCapture ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.header}>
            <Pressable
              style={styles.backButton(isDark)}
              onPress={navigateToTraining}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.light} />
            </Pressable>
            <Text style={styles.headerTitle}>Scan QR Code</Text>
            <View style={{ width: 40 }} />
          </View>

          {networkStatus === 'restricted' && (
            <View style={styles.networkBannerRestricted}>
              <Ionicons name="wifi-outline" size={18} color={Colors.light} />
              <Text style={styles.networkBannerText}>{networkMessage}</Text>
              <Pressable onPress={checkNetwork} style={styles.networkBannerAction}>
                <Text style={styles.networkBannerActionText}>Check again</Text>
              </Pressable>
            </View>
          )}

          {networkStatus === 'unavailable' && (
            <View style={styles.networkBannerUnavailable}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.light} />
              <Text style={styles.networkBannerText}>{networkMessage}</Text>
            </View>
          )}

          {networkStatus === 'ok' && (
            <View style={styles.networkBannerOk}>
              <Ionicons name="wifi" size={16} color={Colors.good} />
              <Text style={styles.networkBannerOkText}>On school WiFi</Text>
            </View>
          )}

          <View style={styles.scanFrame}>
            <View style={styles.scanFrameCorner('top-left')} />
            <View style={styles.scanFrameCorner('top-right')} />
            <View style={styles.scanFrameCorner('bottom-left')} />
            <View style={styles.scanFrameCorner('bottom-right')} />
          </View>

          <View style={styles.instructionsContainer(isDark)}>
            {processing ? (
              <View style={styles.processingContainer}>
                <Skeleton width={28} height={28} borderRadius={14} isDark={false} />
                <Text style={styles.instructionsText(isDark)}>Processing…</Text>
              </View>
            ) : (
              <>
                <Text style={styles.instructionsText(isDark)}>
                  Position the QR code within the frame
                </Text>
                <Text style={styles.instructionsSubtext(isDark)}>
                  Make sure the code is clearly visible
                </Text>
              </>
            )}
          </View>
        </View>
      </CameraView>

      <FaceCaptureModal
        visible={showFaceCapture}
        onCapture={handleFaceCapture}
        onCancel={handleFaceCancel}
        errorMessage={faceError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: (isDark) => ({
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  networkBannerRestricted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 152, 0, 0.92)',
  },
  networkBannerUnavailable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(80, 80, 80, 0.92)',
  },
  networkBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light,
    lineHeight: 18,
  },
  networkBannerAction: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  networkBannerActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light,
  },
  networkBannerOk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  networkBannerOkText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.good,
  },
  scanFrame: {
    width: 250,
    height: 250,
    alignSelf: 'center',
    marginTop: 100,
    position: 'relative',
  },
  scanFrameCorner: (position) => {
    const cornerSize = 30;
    const borderWidth = 4;
    let cornerStyle = {
      position: 'absolute',
      width: cornerSize,
      height: cornerSize,
      borderColor: Colors.alpha,
    };

    if (position === 'top-left') {
      cornerStyle = {
        ...cornerStyle,
        top: 0,
        left: 0,
        borderTopWidth: borderWidth,
        borderLeftWidth: borderWidth,
      };
    } else if (position === 'top-right') {
      cornerStyle = {
        ...cornerStyle,
        top: 0,
        right: 0,
        borderTopWidth: borderWidth,
        borderRightWidth: borderWidth,
      };
    } else if (position === 'bottom-left') {
      cornerStyle = {
        ...cornerStyle,
        bottom: 0,
        left: 0,
        borderBottomWidth: borderWidth,
        borderLeftWidth: borderWidth,
      };
    } else if (position === 'bottom-right') {
      cornerStyle = {
        ...cornerStyle,
        bottom: 0,
        right: 0,
        borderBottomWidth: borderWidth,
        borderRightWidth: borderWidth,
      };
    }

    return cornerStyle;
  },
  instructionsContainer: (isDark) => ({
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 40,
  }),
  instructionsText: (isDark) => ({
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 8,
  }),
  instructionsSubtext: (isDark) => ({
    fontSize: 14,
    color: Colors.light + 'CC',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  }),
  processingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  permissionContainer: (isDark) => ({
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: isDark ? Colors.dark : Colors.light,
  }),
  permissionTitle: (isDark) => ({
    fontSize: 24,
    fontWeight: '700',
    color: isDark ? Colors.light : Colors.beta,
    marginTop: 24,
    marginBottom: 12,
  }),
  permissionText: (isDark) => ({
    fontSize: 16,
    color: isDark ? Colors.light + 'CC' : Colors.beta + 'CC',
    textAlign: 'center',
    marginBottom: 32,
  }),
  permissionButton: {
    backgroundColor: Colors.alpha,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: Colors.light,
    fontSize: 16,
    fontWeight: '700',
  },
});
