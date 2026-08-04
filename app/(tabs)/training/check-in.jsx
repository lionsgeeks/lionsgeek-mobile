import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import Skeleton from '@/components/ui/Skeleton';
import {
  CHECKIN_RESTRICTED_FALLBACK,
  CHECKIN_UNAVAILABLE_BANNER,
  CHECKIN_UNAVAILABLE_MESSAGE,
  CHECKIN_UNAVAILABLE_TITLE,
  NETWORK_RESTRICTED_FALLBACK,
  checkAttendanceNetwork,
  deriveCheckInScreenUi,
  fetchSlotStatus,
  formatCheckInSuccessMessage,
  getApiMessage,
  isStaffUser,
  isStudentUser,
  submitCheckIn,
} from '@/components/training/attendanceCheckIn';

const SLOT_STATUS_POLL_MS = 60_000;

/** Visual tokens: prefer Colors.*; hex only where no matching token exists. */
const V = {
  screenBg: '#0b0b0c',
  screenBgLight: Colors.light,
  cardBg: Colors.card_dark,
  cardBgLight: Colors.card,
  border: Colors.card_border_dark,
  primaryText: Colors.light,
  primaryTextLight: Colors.beta,
  secondaryText: '#8a8a8e',
  tertiaryText: '#5f5f61',
  accent: Colors.alpha,
  onAccent: '#1a1400',
  success: Colors.good,
  danger: Colors.error,
};

function WifiPill({ networkStatus, networkMessage, onRetry, isDark }) {
  if (networkStatus === 'checking') {
    return (
      <View style={styles.pillChecking}>
        <ActivityIndicator size="small" color={V.secondaryText} />
        <Text style={styles.pillCheckingText}>Checking connection</Text>
      </View>
    );
  }

  if (networkStatus === 'ok') {
    return (
      <View style={styles.pillSuccess}>
        <Ionicons name="wifi-outline" size={14} color={V.success} />
        <Text style={styles.pillSuccessText}>On school wifi</Text>
      </View>
    );
  }

  if (networkStatus === 'restricted' || networkStatus === 'unavailable') {
    return (
      <Pressable
        style={styles.pillDanger}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={networkMessage || 'Not on school wifi. Tap to check again.'}
      >
        <Ionicons name="wifi-outline" size={14} color={V.danger} />
        <Text style={styles.pillDangerText}>Not on school wifi</Text>
      </Pressable>
    );
  }

  return null;
}

function StatusCard({ ui, isDark, onRetry }) {
  const iconColor =
    ui.iconTone === 'success'
      ? V.success
      : ui.iconTone === 'warning'
        ? V.accent
        : ui.iconTone === 'error'
          ? V.danger
          : isDark
            ? V.secondaryText
            : Colors.beta;

  return (
    <View
      style={[styles.statusCard, !isDark && styles.statusCardLight]}
      accessibilityRole="text"
      accessibilityLabel={`${ui.primaryLine}. ${ui.secondaryLine || ''}`}
    >
      <View
        style={[
          styles.statusIconWrap,
          ui.iconTone === 'success' && styles.statusIconWrapSuccess,
          ui.iconTone === 'warning' && styles.statusIconWrapWarning,
        ]}
      >
        <Ionicons name={ui.icon} size={26} color={iconColor} />
      </View>
      <Text style={[styles.statusPrimary, !isDark && styles.statusPrimaryLight]}>
        {ui.primaryLine}
      </Text>
      {ui.secondaryLine ? (
        <Text style={styles.statusSecondary}>{ui.secondaryLine}</Text>
      ) : null}
      {ui.mode === 'error' && onRetry ? (
        <Pressable
          style={({ pressed }) => [
            styles.retryButton,
            !isDark && styles.retryButtonLight,
            pressed && styles.pressed,
          ]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry loading attendance status"
          className={`px-4 flex flex-row gap-x-2 py-2  rounded-md mt-2`}
        >
          <Ionicons
            name="refresh-outline"
            size={16}
            color={isDark ? V.primaryText : V.primaryTextLight}
          />
          <Text style={[styles.retryButtonText, !isDark && styles.retryButtonTextLight]}>
            Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function AttendanceCheckIn() {
  const router = useRouter();
  const { token, user } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const formationId = user?.formation_id != null ? Number(user.formation_id) : null;
  const pollRef = useRef(null);
  const fetchInFlightRef = useRef(false);

  const [slotStatus, setSlotStatus] = useState(null);
  const [slotLoading, setSlotLoading] = useState(true);
  const [slotFetchError, setSlotFetchError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [networkStatus, setNetworkStatus] = useState(null);
  const [networkMessage, setNetworkMessage] = useState('');
  const [lastCheckInResult, setLastCheckInResult] = useState(null);

  const screenUi = useMemo(
    () =>
      deriveCheckInScreenUi(slotStatus, {
        networkStatus,
        slotFetchError,
        lastCheckInResult,
      }),
    [slotStatus, networkStatus, slotFetchError, lastCheckInResult],
  );

  const refreshSlotStatus = useCallback(
    async ({ fromPull = false } = {}) => {
      if (!token || !formationId || !isStudentUser(user)) return;
      if (fetchInFlightRef.current && !fromPull) return;

      fetchInFlightRef.current = true;
      if (fromPull) setRefreshing(true);

      try {
        const data = await fetchSlotStatus(token, formationId);
        setSlotStatus(data);
        setSlotFetchError(false);
      } catch (error) {
        console.error('[CHECK-IN] slot-status error:', error);
        setSlotFetchError(true);
      } finally {
        setSlotLoading(false);
        setRefreshing(false);
        fetchInFlightRef.current = false;
      }
    },
    [token, formationId, user],
  );

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

  useFocusEffect(
    useCallback(() => {
      checkNetwork();
      refreshSlotStatus();
    }, [checkNetwork, refreshSlotStatus]),
  );

  useEffect(() => {
    if (!token || !formationId || !isStudentUser(user)) return undefined;

    pollRef.current = setInterval(() => {
      refreshSlotStatus();
    }, SLOT_STATUS_POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [token, formationId, user, refreshSlotStatus]);

  const handleCheckInRestricted = useCallback(
    (error) => {
      const message = getApiMessage(error, CHECKIN_RESTRICTED_FALLBACK);
      Alert.alert('Cannot Check In', message, [
        { text: 'OK' },
        {
          text: 'Retry',
          onPress: async () => {
            if (!token || !slotStatus?.attendance_day || !formationId) return;
            setCheckingIn(true);
            try {
              await checkAttendanceNetwork(token);
              setNetworkStatus('ok');
              setNetworkMessage('');
              const data = await submitCheckIn(token, {
                formation_id: formationId,
                attendance_day: slotStatus.attendance_day,
              });
              setLastCheckInResult(data);
              Alert.alert('Attendance Marked', formatCheckInSuccessMessage(data));
              await refreshSlotStatus();
            } catch (retryError) {
              if (retryError?.response?.status === 403) {
                handleCheckInRestricted(retryError);
              } else if (retryError?.response?.status === 503) {
                Alert.alert(CHECKIN_UNAVAILABLE_TITLE, CHECKIN_UNAVAILABLE_MESSAGE);
              } else if (retryError?.response?.status === 409 || retryError?.response?.status === 422) {
                await refreshSlotStatus();
              } else {
                Alert.alert('Error', 'Failed to mark attendance. Please try again.');
              }
            } finally {
              setCheckingIn(false);
            }
          },
        },
      ]);
    },
    [token, slotStatus, formationId, refreshSlotStatus],
  );

  const handleCheckIn = useCallback(async () => {
    if (!token || !formationId || !slotStatus?.attendance_day || checkingIn || !screenUi.actionable) {
      return;
    }

    setCheckingIn(true);
    try {
      const data = await submitCheckIn(token, {
        formation_id: formationId,
        attendance_day: slotStatus.attendance_day,
      });
      setLastCheckInResult(data);
      Alert.alert('Attendance Marked', formatCheckInSuccessMessage(data));
      await refreshSlotStatus();
    } catch (error) {
      const status = error?.response?.status;
      if (status === 403) {
        handleCheckInRestricted(error);
      } else if (status === 503) {
        Alert.alert(CHECKIN_UNAVAILABLE_TITLE, CHECKIN_UNAVAILABLE_MESSAGE);
      } else if (status === 409) {
        await refreshSlotStatus();
        Alert.alert('Already Marked', getApiMessage(error, 'You have already marked attendance for this slot.'));
      } else if (status === 422) {
        await refreshSlotStatus();
        Alert.alert('No Active Slot', getApiMessage(error, 'There is no active attendance slot right now.'));
      } else {
        console.error('[CHECK-IN] check-in error:', error);
        Alert.alert('Error', 'Failed to mark attendance. Please try again.');
      }
    } finally {
      setCheckingIn(false);
    }
  }, [
    token,
    formationId,
    slotStatus,
    checkingIn,
    screenUi.actionable,
    refreshSlotStatus,
    handleCheckInRestricted,
  ]);

  const onPullRefresh = useCallback(async () => {
    await Promise.all([refreshSlotStatus({ fromPull: true }), checkNetwork()]);
  }, [refreshSlotStatus, checkNetwork]);

  if (isStaffUser(user)) {
    return (
      <AppLayout>
        <View style={[styles.centered, { backgroundColor: isDark ? V.screenBg : V.screenBgLight }]}>
          <Ionicons name="lock-closed-outline" size={48} color={V.accent} />
          <Text style={[styles.guardTitle, !isDark && styles.guardTitleLight]}>Student check-in only</Text>
          <Text style={styles.guardSubtitle}>
            Attendance check-in is available to enrolled students.
          </Text>
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </AppLayout>
    );
  }

  if (!formationId) {
    return (
      <AppLayout>
        <View style={[styles.centered, { backgroundColor: isDark ? V.screenBg : V.screenBgLight }]}>
          <Ionicons name="school-outline" size={48} color={V.accent} />
          <Text style={[styles.guardTitle, !isDark && styles.guardTitleLight]}>No training enrolled</Text>
          <Text style={styles.guardSubtitle}>
            You need an active training enrollment to check in. Contact staff if this looks wrong.
          </Text>
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </AppLayout>
    );
  }

  const showSkeleton = slotLoading && !slotStatus && !slotFetchError;
  const showCta = screenUi.mode === 'ready' && !showSkeleton;
  const showStatusCard = !showSkeleton && !showCta;
  const ctaIconColor = screenUi.mutedCta ? V.tertiaryText : V.onAccent;
  const ctaSpinnerColor = screenUi.mutedCta ? V.tertiaryText : V.onAccent;

  return (
    <AppLayout className={isDark ? 'bg-[#0b0b0c] dark:bg-[#0b0b0c]' : ''}>
      <View style={[styles.screen, { backgroundColor: isDark ? V.screenBg : V.screenBgLight }]}>
        <View style={styles.headerRow}>
          <Pressable
            style={[styles.backButton, !isDark && styles.backButtonLight]}
            onPress={() => router.back()}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={22} color={isDark ? V.primaryText : V.primaryTextLight} />
          </Pressable>
          <Text style={[styles.headerTitle, !isDark && styles.headerTitleLight]}>Mark attendance</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullRefresh}
              tintColor={V.accent}
              colors={[V.accent]}
            />
          }
        >
          <View style={styles.topStack}>
            {slotFetchError && networkStatus == null ? (
              <View style={styles.pillChecking}>
                <Ionicons name="wifi-outline" size={14} color={V.secondaryText} />
                <Text style={styles.pillCheckingText}>Checking connection</Text>
              </View>
            ) : (
              <WifiPill
                networkStatus={networkStatus}
                networkMessage={networkMessage}
                onRetry={checkNetwork}
                isDark={isDark}
              />
            )}

            {showCta && screenUi.sessionRangeLabel ? (
              <Text style={styles.sessionRange}>{screenUi.sessionRangeLabel}</Text>
            ) : null}
          </View>

          <View style={styles.content}>
            {showSkeleton ? (
              <View style={styles.loadingBlock}>
                <Skeleton width={280} height={88} borderRadius={14} isDark={isDark} />
                <View style={{ height: 16 }} />
                <Skeleton width={200} height={12} borderRadius={8} isDark={isDark} />
              </View>
            ) : null}

            {showCta ? (
              <View style={styles.readyBlock}>
                <Pressable
                  style={({ pressed }) => [
                    styles.checkInButton,
                    screenUi.mutedCta && styles.checkInButtonMuted,
                    pressed && !checkingIn && styles.pressed,
                  ]}
                  onPress={handleCheckIn}
                  disabled={checkingIn}
                  accessibilityRole="button"
                  accessibilityLabel={screenUi.label}
                >
                  {checkingIn ? (
                    <ActivityIndicator color={ctaSpinnerColor} />
                  ) : (
                    <View className='flex items-center justify-center gap-2'>
                      <Ionicons name="location-outline" size={28} color={ctaIconColor} />
                      <Text
                        style={[
                          styles.checkInButtonText,
                          screenUi.mutedCta && styles.checkInButtonTextMuted,
                        ]}
                      >
                        {screenUi.label}
                      </Text>
                    </View>
                  )}
                </Pressable>
                {screenUi.helperText ? (
                  <Text
                    style={[
                      styles.helperText,
                      screenUi.helperTone === 'danger' && styles.helperTextDanger,
                    ]}
                  >
                    {screenUi.helperText}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {showStatusCard ? (
              <>
                <StatusCard ui={screenUi} isDark={isDark} onRetry={() => refreshSlotStatus()} />
                {screenUi.nextSlotBanner ? (
                  <View style={[styles.nextSlotBanner, !isDark && styles.nextSlotBannerLight]}>
                    <Text style={styles.nextSlotLeft}>{screenUi.nextSlotBanner.left}</Text>
                    {screenUi.nextSlotBanner.right ? (
                      <Text style={[styles.nextSlotRight, !isDark && styles.nextSlotRightLight]}>
                        {screenUi.nextSlotBanner.right}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {screenUi.helperText ? (
                  <Text style={styles.helperText}>{screenUi.helperText}</Text>
                ) : null}
              </>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </AppLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: V.cardBg,
  },
  backButtonLight: {
    backgroundColor: V.cardBgLight,
    borderWidth: 1,
    borderColor: Colors.dark_gray + '22',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: V.primaryText,
  },
  headerTitleLight: {
    color: V.primaryTextLight,
  },
  topStack: {
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  pillSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(81, 176, 79, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(81, 176, 79, 0.4)',
  },
  pillSuccessText: {
    fontSize: 12,
    fontWeight: '600',
    color: V.success,
  },
  pillDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  pillDangerText: {
    fontSize: 12,
    fontWeight: '600',
    color: V.danger,
  },
  pillChecking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: V.cardBg,
  },
  pillCheckingText: {
    fontSize: 12,
    fontWeight: '500',
    color: V.secondaryText,
  },
  sessionRange: {
    fontSize: 12,
    color: V.secondaryText,
    textAlign: 'center',
  },
  reminderBanner: {
    width: '100%',
    maxWidth: 340,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: V.cardBg,
  },
  reminderBannerLight: {
    backgroundColor: V.cardBgLight,
    borderWidth: 1,
    borderColor: Colors.dark_gray + '18',
  },
  reminderBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reminderBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: V.primaryText,
    lineHeight: 20,
  },
  reminderBannerTextLight: {
    color: V.primaryTextLight,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
    minHeight: 280,
  },
  readyBlock: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    backgroundColor: Colors.alpha,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  loadingBlock: {
    alignItems: 'center',
    width: '100%',
  },
  checkInButton: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 28,
    backgroundColor: V.accent,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  checkInButtonMuted: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: V.border,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  checkInButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: V.onAccent,
    textAlign: 'center',
  },
  checkInButtonTextMuted: {
    color: V.tertiaryText,
  },
  helperText: {
    marginTop: 16,
    maxWidth: 300,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    color: V.secondaryText,
  },
  helperTextDanger: {
    color: V.danger,
  },
  statusCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: V.cardBg,
  },
  statusCardLight: {
    backgroundColor: V.cardBgLight,
    borderWidth: 1,
    borderColor: Colors.dark_gray + '18',
  },
  statusIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statusIconWrapSuccess: {
    backgroundColor: 'rgba(81, 176, 79, 0.15)',
  },
  statusIconWrapWarning: {
    backgroundColor: 'rgba(255, 200, 1, 0.12)',
  },
  statusPrimary: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    color: V.primaryText,
  },
  statusPrimaryLight: {
    color: V.primaryTextLight,
  },
  statusSecondary: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: V.secondaryText,
  },
  retryButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: V.primaryText,
  },
  retryButtonLight: {
    borderColor: V.primaryTextLight,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: V.primaryText,
  },
  retryButtonTextLight: {
    color: V.primaryTextLight,
  },
  nextSlotBanner: {
    width: '100%',
    maxWidth: 340,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: V.cardBg,
  },
  nextSlotBannerLight: {
    backgroundColor: V.cardBgLight,
    borderWidth: 1,
    borderColor: Colors.dark_gray + '18',
  },
  nextSlotLeft: {
    fontSize: 13,
    color: V.secondaryText,
  },
  nextSlotRight: {
    fontSize: 13,
    fontWeight: '600',
    color: V.primaryText,
  },
  nextSlotRightLight: {
    color: V.primaryTextLight,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  guardTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '800',
    color: V.primaryText,
    textAlign: 'center',
  },
  guardTitleLight: {
    color: V.primaryTextLight,
  },
  guardSubtitle: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: V.secondaryText,
    textAlign: 'center',
  },
  secondaryButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: V.accent,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: V.accent,
  },
});
