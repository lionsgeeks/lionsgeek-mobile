import { Modal, Pressable, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Overlays } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ReservationPickerSheet({
  visible,
  title,
  onClose,
  onDone,
  pickerProps,
}) {
  const isDark = useColorScheme() === 'dark';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: Overlays.modalScrim }}
          onPress={onClose}
        />
        <View className="bg-light dark:bg-dark rounded-t-3xl overflow-hidden border-t border-beta/10 dark:border-light/10">
          <View className="items-center pt-3 pb-2">
            <View className="w-9 h-1 rounded-full bg-beta/20 dark:bg-light/20" />
          </View>

          <View className="px-5 pb-3 flex-row items-center justify-between border-b border-beta/10 dark:border-light/10">
            <Text className="text-lg font-bold text-beta dark:text-light">{title}</Text>
            <Pressable
              onPress={onClose}
              className="w-10 h-10 rounded-xl bg-beta/10 dark:bg-light/10 items-center justify-center active:opacity-80"
            >
              <Ionicons name="close" size={22} color={isDark ? Colors.light : Colors.beta} />
            </Pressable>
          </View>

          <View className="px-5 py-4">
            <DateTimePicker
              {...pickerProps}
              style={{ width: '100%' }}
              textColor={isDark ? Colors.light : Colors.beta}
            />
          </View>

          <View className="px-5 pb-8 pt-2">
            <Pressable
              onPress={onDone || onClose}
              className="bg-beta dark:bg-alpha py-3.5 rounded-2xl items-center active:opacity-90"
            >
              <Text className="text-sm font-bold text-light dark:text-beta">Done</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
