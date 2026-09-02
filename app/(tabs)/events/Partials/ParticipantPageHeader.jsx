import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Skeleton from '@/components/ui/Skeleton';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ParticipantPageHeader({ title, loading }) {
  const isDark = useColorScheme() === 'dark';

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
          Visitor
        </Text>
        {loading ? (
          <Skeleton width={140} height={16} borderRadius={6} isDark={isDark} />
        ) : (
          <Text className="text-base font-bold text-beta dark:text-light" numberOfLines={1}>
            {title || 'Participant'}
          </Text>
        )}
      </View>
    </View>
  );
}
