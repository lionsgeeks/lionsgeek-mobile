import { Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Overlays } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ReservationSuccessModal({
  visible,
  title = 'Success!',
  message = 'Reservation created successfully',
  onAddToCalendar,
  onClose,
}) {
  const isDark = useColorScheme() === 'dark';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center px-5" style={{ backgroundColor: Overlays.modalScrim }}>
        <View className="w-full max-w-sm bg-white dark:bg-card border border-beta/10 dark:border-card_border rounded-2xl p-6 items-center">
          <View className="w-16 h-16 rounded-full bg-good/15 items-center justify-center mb-4">
            <Ionicons name="checkmark-circle" size={40} color={Colors.good} />
          </View>
          <Text className="text-xl font-bold text-beta dark:text-light text-center mb-2">{title}</Text>
          <Text className="text-sm text-beta/60 dark:text-light/60 text-center mb-6">{message}</Text>

          <View className="flex-row gap-3 w-full">
            {onAddToCalendar ? (
              <Pressable
                onPress={onAddToCalendar}
                className="flex-1 items-center justify-center rounded-2xl border border-beta/10 dark:border-light/10 py-3.5 active:opacity-80"
              >
                <Text className="text-sm font-semibold text-beta dark:text-light">Add to Calendar</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onClose}
              className={`${onAddToCalendar ? 'flex-1' : 'w-full'} items-center justify-center rounded-2xl bg-beta dark:bg-alpha py-3.5 active:opacity-90`}
            >
              <Text className="text-sm font-bold text-light dark:text-beta">Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
