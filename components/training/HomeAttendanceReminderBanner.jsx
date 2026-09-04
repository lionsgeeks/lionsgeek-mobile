import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import { Colors } from '@/constants/Colors';
import {
  fetchSlotStatus,
  getAttendanceReminderBannerText,
  getReminderDismissKey,
  isStudentUser,
  shouldShowReminderBanner,
} from '@/components/training/attendanceCheckIn';

const SLOT_STATUS_POLL_MS = 60_000;

export default function HomeAttendanceReminderBanner() {
  const router = useRouter();
  const { token, user } = useAppContext();
  const formationId = user?.formation_id != null ? Number(user.formation_id) : null;

  const [slotStatus, setSlotStatus] = useState(null);
  const [dismissedDismissKey, setDismissedDismissKey] = useState(null);
  const isFocusedRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  const refreshSlotStatus = useCallback(async () => {
    if (!token || !formationId || !isStudentUser(user)) return;
    try {
      const data = await fetchSlotStatus(token, formationId);
      setSlotStatus(data);
    } catch {
      // Attendance may be unavailable (e.g. network not configured); hide banner quietly.
    }
  }, [token, formationId, user]);

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;
      refreshSlotStatus();

      const interval = setInterval(() => {
        if (isFocusedRef.current && appStateRef.current === 'active') {
          refreshSlotStatus();
        }
      }, SLOT_STATUS_POLL_MS);

      return () => {
        isFocusedRef.current = false;
        clearInterval(interval);
      };
    }, [refreshSlotStatus]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState === 'active' && isFocusedRef.current) {
        refreshSlotStatus();
      }
    });

    return () => subscription.remove();
  }, [refreshSlotStatus]);

  if (!token || !formationId || !isStudentUser(user)) {
    return null;
  }

  if (!shouldShowReminderBanner(slotStatus, dismissedDismissKey)) {
    return null;
  }

  const bannerText = getAttendanceReminderBannerText(slotStatus);

  return (
    <View style={styles.banner}>
      <Pressable
        style={styles.bannerBody}
        onPress={() => router.push('/(tabs)/training/check-in')}
        accessibilityRole="button"
        accessibilityLabel={bannerText}
      >
        <Ionicons name="notifications-outline" size={18} color={Colors.beta} />
        <Text style={styles.bannerText}>{bannerText}</Text>
      </Pressable>
      <Pressable
        style={styles.dismissButton}
        onPress={() => setDismissedDismissKey(getReminderDismissKey(slotStatus))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Dismiss attendance reminder"
      >
        <Ionicons name="close" size={20} color={Colors.beta} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 4,
    marginBottom: 4,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 8,
    borderRadius: 12,
    backgroundColor: Colors.alpha,
    zIndex: 10,
    elevation: 4,
  },
  bannerBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.beta,
    lineHeight: 20,
  },
  dismissButton: {
    padding: 6,
    marginLeft: 4,
  },
});
