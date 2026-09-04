import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileTopBar({
  profile,
  isOwnProfile,
  userId,
  insets,
  isDark,
  onOpenOptions,
}) {
  return (
    <View
      className="flex-row items-center justify-between px-4 bg-light dark:bg-dark border-b border-black/5 dark:border-dark_gray"
      style={{ paddingTop: insets.top + 10, paddingBottom: 10, zIndex: 10 }}
    >
      {isOwnProfile && !userId ? (
        <View style={{ width: 28 }} />
      ) : (
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
      )}

      <Text className="text-base font-bold text-black dark:text-white tracking-wide">
        {profile?.name || 'Profile'}
      </Text>

      {isOwnProfile ? (
        <TouchableOpacity onPress={() => router.push('/(tabs)/more')} hitSlop={12} activeOpacity={0.7}>
          <Ionicons name="menu-outline" size={26} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onOpenOptions}
          hitSlop={12}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Profile options"
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={isDark ? '#fff' : '#000'} />
        </TouchableOpacity>
      )}
    </View>
  );
}
