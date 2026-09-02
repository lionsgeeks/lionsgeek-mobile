import { View, Text } from 'react-native';
import { Colors, getAccentFillColor } from '@/constants/Colors';

export function getReservationCalendarTheme(isDark) {
  const accent = getAccentFillColor(isDark);
  const onAccent = isDark ? Colors.beta : Colors.light;

  return {
    backgroundColor: isDark ? Colors.dark : Colors.light,
    calendarBackground: isDark ? Colors.dark : Colors.light,
    dayTextColor: isDark ? Colors.light : Colors.beta,
    monthTextColor: isDark ? Colors.light : Colors.beta,
    arrowColor: accent,
    todayTextColor: accent,
    selectedDayBackgroundColor: accent,
    selectedDayTextColor: onAccent,
    textDisabledColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
    textDayFontWeight: '600',
    textMonthFontWeight: '700',
    textDayHeaderFontWeight: '700',
    textDayHeaderFontColor: isDark ? Colors.light : Colors.beta,
    textMonthFontSize: 18,
    textDayHeaderFontSize: 12,
    'stylesheet.calendar.header': {
      monthText: {
        fontSize: 18,
        fontWeight: '700',
        color: isDark ? Colors.light : Colors.beta,
        marginTop: 4,
        marginBottom: 8,
      },
      week: {
        marginTop: 6,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingBottom: 6,
      },
      dayHeader: {
        marginTop: 2,
        marginBottom: 6,
        textAlign: 'center',
        fontSize: 12,
        fontWeight: '700',
        color: isDark ? Colors.light : Colors.beta,
      },
    },
    'stylesheet.day.basic': {
      base: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
      },
      todayText: {
        color: accent,
        fontWeight: '700',
        fontSize: 15,
      },
      selected: {
        backgroundColor: accent,
        borderRadius: 16,
      },
      selectedText: {
        color: onAccent,
        fontWeight: '700',
        fontSize: 15,
      },
      text: {
        marginTop: 0,
        fontSize: 15,
        fontWeight: '600',
        color: isDark ? Colors.light : Colors.beta,
      },
      disabledText: {
        color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
      },
    },
  };
}

export function ReservationStatusBadge({ status }) {
  const normalized = String(status || '').toLowerCase();

  if (normalized.includes('approve') || normalized.includes('active')) {
    return (
      <View className="bg-good/15 px-2.5 py-1 rounded-full">
        <Text className="text-[10px] font-semibold text-good uppercase">{status || 'Approved'}</Text>
      </View>
    );
  }
  if (normalized.includes('pending')) {
    return (
      <View className="bg-beta/15 dark:bg-alpha/15 px-2.5 py-1 rounded-full">
        <Text className="text-[10px] font-semibold text-beta dark:text-alpha uppercase">{status || 'Pending'}</Text>
      </View>
    );
  }
  if (normalized.includes('reject') || normalized.includes('cancel')) {
    return (
      <View className="bg-error/15 px-2.5 py-1 rounded-full">
        <Text className="text-[10px] font-semibold text-error uppercase">{status || 'Cancelled'}</Text>
      </View>
    );
  }

  return (
    <View className="bg-beta/10 dark:bg-light/10 px-2.5 py-1 rounded-full">
      <Text className="text-[10px] font-semibold text-beta/50 dark:text-light/50 uppercase">{status || 'Unknown'}</Text>
    </View>
  );
}

export function ReservationHistoryStatusBadge({ label }) {
  if (label === 'Cancelled') {
    return (
      <View className="bg-error/15 px-2.5 py-1 rounded-full">
        <Text className="text-[10px] font-semibold text-error uppercase">{label}</Text>
      </View>
    );
  }
  if (label === 'Pending approval') {
    return (
      <View className="bg-beta/15 dark:bg-alpha/15 px-2.5 py-1 rounded-full">
        <Text className="text-[10px] font-semibold text-beta dark:text-alpha uppercase">Pending</Text>
      </View>
    );
  }
  return (
    <View className="bg-good/15 px-2.5 py-1 rounded-full">
      <Text className="text-[10px] font-semibold text-good uppercase">{label}</Text>
    </View>
  );
}
