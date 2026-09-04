import { View } from 'react-native';
import Skeleton from '@/components/ui/Skeleton';

export default function ProfileSkeleton({ isDark, topInset = 0 }) {
  return (
    <View className="flex-1 bg-light dark:bg-dark">
      {/* Skeleton top bar placeholder */}
      <View style={{ height: topInset + 46 }} className="bg-light dark:bg-dark border-b border-black/5 dark:border-dark_gray" />
      {/* Cover */}
      <View className="h-44 bg-alpha/10 dark:bg-alpha/5" />

      {/* Profile Row */}
      <View className="flex-row items-start px-4 -mt-12 mb-3">
        <Skeleton width={90} height={90} borderRadius={45} isDark={isDark} />
        <View className="flex-1 flex-row justify-around mt-14 ml-2">
          {[0, 1, 2].map((i) => (
            <View key={i} className="items-center gap-1">
              <Skeleton width={36} height={16} borderRadius={8} isDark={isDark} />
              <Skeleton width={52} height={10} borderRadius={8} isDark={isDark} />
            </View>
          ))}
        </View>
      </View>

      {/* Bio */}
      <View className="px-4 gap-2 mb-4">
        <Skeleton width={160} height={16} borderRadius={8} isDark={isDark} />
        <Skeleton width={120} height={12} borderRadius={8} isDark={isDark} />
        <Skeleton width={200} height={12} borderRadius={8} isDark={isDark} />
      </View>

      {/* Buttons */}
      <View className="px-4 flex-row gap-2 mb-5">
        <Skeleton width="75%" height={40} borderRadius={10} isDark={isDark} />
        <Skeleton width={40} height={40} borderRadius={10} isDark={isDark} />
        <Skeleton width={40} height={40} borderRadius={10} isDark={isDark} />
      </View>

      {/* Section card placeholders */}
      {Array.from({ length: 3 }).map((_, i) => (
        <View key={i} className="mx-4 mb-3 rounded-2xl border border-black/10 dark:border-white/10 p-4 gap-2">
          <Skeleton width={100} height={14} borderRadius={7} isDark={isDark} />
          <Skeleton width="90%" height={12} borderRadius={7} isDark={isDark} />
          <Skeleton width="70%" height={12} borderRadius={7} isDark={isDark} />
        </View>
      ))}
    </View>
  );
}
