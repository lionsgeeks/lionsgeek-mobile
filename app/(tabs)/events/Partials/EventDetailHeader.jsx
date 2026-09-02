import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Skeleton from '@/components/ui/Skeleton';
import { Colors, getOnAccentTextColor, Overlays } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function EventDetailHeader({
  title,
  loading,
  scannable,
  scanDisabledLabel,
  onScanPress,
  showScanButton = false,
}) {
  const isDark = useColorScheme() === 'dark';
  const onAccentText = getOnAccentTextColor(isDark);
  const showScan = showScanButton;

  return (
    <View className="pt-3 pb-3 px-4 flex-row items-center gap-2 border-b border-beta/8 dark:border-light/8">
      <Pressable
        onPress={() => router.back()}
        className="w-10 h-10 rounded-xl items-center justify-center active:opacity-70"
      >
        <Ionicons name="arrow-back" size={20} color={isDark ? Colors.light : Colors.beta} />
      </Pressable>
      <View className="flex-1 min-w-0">
        <Text className="text-xs font-semibold uppercase tracking-wide text-beta/45 dark:text-light/45">
          Events
        </Text>
        {loading ? (
          <Skeleton width={160} height={16} borderRadius={6} isDark={isDark} />
        ) : (
          <Text className="text-base font-bold text-beta dark:text-light" numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>
      {showScan ? (
        <Pressable
          onPress={scannable ? onScanPress : undefined}
          disabled={!scannable}
          className={`flex-row items-center gap-1.5 px-3 py-2 rounded-xl ${
            scannable ? 'bg-beta dark:bg-alpha active:opacity-80' : 'bg-beta/10 dark:bg-light/10'
          }`}
        >
          <Ionicons
            name="qr-code"
            size={17}
            color={scannable ? onAccentText : isDark ? Overlays.disabledIcon : Overlays.disabledIconLight}
          />
          <Text
            className={`text-xs font-bold ${
              scannable ? 'text-light dark:text-beta' : 'text-beta/35 dark:text-light/35'
            }`}
          >
            {scannable ? 'Scan' : scanDisabledLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
