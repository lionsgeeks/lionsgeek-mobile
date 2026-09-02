import { View, Text, TouchableOpacity } from 'react-native';

export default function StatColumn({ label, value, onPress }) {
  return (
    <TouchableOpacity className="items-center flex-1" onPress={onPress} activeOpacity={0.7}>
      <Text className="text-lg font-bold text-black dark:text-white">{value ?? 0}</Text>
      <Text className="text-xs text-black/50 dark:text-dark_gray0 mt-0.5">{label}</Text>
    </TouchableOpacity>
  );
}
