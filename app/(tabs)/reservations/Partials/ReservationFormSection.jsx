import { View, Text, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SectionCard from '@/components/ui/SectionCard';
import { getAccentIconColor } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ReservationFormSection({ icon, title, children, className = '' }) {
  const isDark = useColorScheme() === 'dark';
  const accentIcon = getAccentIconColor(isDark);

  return (
    <SectionCard className={className}>
      <View className="p-4">
        <View className="flex-row items-center gap-3 mb-3">
          <View className="w-10 h-10 rounded-xl bg-beta/10 dark:bg-alpha/15 items-center justify-center">
            <Ionicons name={icon} size={20} color={accentIcon} />
          </View>
          <Text className="text-base font-bold text-beta dark:text-light">{title}</Text>
        </View>
        {children}
      </View>
    </SectionCard>
  );
}

export function ReservationFieldInput({ className = '', ...props }) {
  return (
    <TextInput
      placeholderTextColor="#888"
      className={`min-h-12 rounded-xl border border-beta/10 dark:border-light/10 bg-light dark:bg-dark px-4 py-3 text-sm text-beta dark:text-light ${className}`}
      {...props}
    />
  );
}

// TextInput must be imported where used — export helper for multiline
export function reservationInputClass(multiline = false) {
  return `rounded-xl border border-beta/10 dark:border-light/10 bg-light dark:bg-dark px-4 py-3 text-sm text-beta dark:text-light${
    multiline ? ' min-h-[100px] textAlignVertical-top' : ' min-h-12'
  }`;
}
