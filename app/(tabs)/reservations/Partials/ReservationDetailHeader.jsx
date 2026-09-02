import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Skeleton from '@/components/ui/Skeleton';
import { Colors, getOnAccentTextColor } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ReservationDetailHeader({
  title,
  subtitle,
  loading = false,
  rightAction,
}) {
  const isDark = useColorScheme() === 'dark';
  const onAccentText = getOnAccentTextColor(isDark);

  return (
    <View className="pt-3 pb-3 px-4 flex-row items-center gap-2 border-b border-beta/8 dark:border-light/8 bg-light dark:bg-dark">
      <Pressable
        onPress={() => router.back()}
        className="w-10 h-10 rounded-xl items-center justify-center active:opacity-70"
      >
        <Ionicons name="arrow-back" size={20} color={isDark ? Colors.light : Colors.beta} />
      </Pressable>
      <View className="flex-1 min-w-0">
        <Text className="text-xs font-semibold uppercase tracking-wide text-beta/45 dark:text-light/45">
          Reservations
        </Text>
        {loading ? (
          <Skeleton width={160} height={16} borderRadius={6} isDark={isDark} />
        ) : (
          <>
            <Text className="text-base font-bold text-beta dark:text-light" numberOfLines={1}>
              {title || 'Reservation'}
            </Text>
            {subtitle ? (
              <Text className="text-xs text-beta/55 dark:text-light/55 mt-0.5" numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </>
        )}
      </View>
      {rightAction ? (
        <Pressable
          onPress={rightAction.onPress}
          disabled={rightAction.disabled}
          className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl ${
            rightAction.disabled
              ? 'bg-beta/10 dark:bg-light/10'
              : 'bg-beta dark:bg-alpha active:opacity-80'
          }`}
        >
          {rightAction.icon ? (
            <Ionicons
              name={rightAction.icon}
              size={17}
              color={rightAction.disabled ? (isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)') : onAccentText}
            />
          ) : null}
          <Text
            className={`text-xs font-bold ${
              rightAction.disabled ? 'text-beta/35 dark:text-light/35' : 'text-light dark:text-beta'
            }`}
          >
            {rightAction.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
