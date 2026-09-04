import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAccentIconColor } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import EventCoverImage from '../../events/Partials/EventCoverImage';
import API from '@/api';

function getPlaceImageUrl(place) {
  if (!place?.image) return null;
  if (place.image.startsWith('http')) return place.image;
  return `${API.APP_URL || ''}/storage/${place.image}`;
}

function getPlaceDescription(place) {
  if (place?.description) return place.description;
  const name = (place?.name || '').toLowerCase();
  if (name.includes('studio')) return 'Professional recording space';
  if (name.includes('cowork')) return 'Collaborative workspace';
  if (name.includes('meeting')) return 'Private meeting room';
  return 'Available space for booking';
}

function getPlaceTypeLabel(place) {
  if (place?.type === 'cowork') return 'Cowork';
  if (place?.type === 'meeting') return 'Meeting';
  if (place?.type === 'studio') return 'Studio';
  return 'Space';
}

export default function PlaceCard({ place, onPress }) {
  const isDark = useColorScheme() === 'dark';
  const accentIcon = getAccentIconColor(isDark);
  const coverUrl = getPlaceImageUrl(place);
  const description = getPlaceDescription(place);
  const typeLabel = getPlaceTypeLabel(place);

  return (
    <Pressable
      onPress={onPress}
      className="bg-light dark:bg-dark border border-beta/10 dark:border-light/10 rounded-2xl overflow-hidden mb-3 active:opacity-90"
    >
      <EventCoverImage uri={coverUrl} height={128} />

      <View className="p-4">
        <View className="flex-row items-start justify-between gap-2">
          <Text className="flex-1 text-base font-bold text-beta dark:text-light" numberOfLines={2}>
            {place?.name || 'Space'}
          </Text>
          <View className="bg-beta/15 dark:bg-alpha/15 px-2 py-1 rounded-full">
            <Text className="text-[10px] font-semibold text-beta dark:text-alpha">{typeLabel}</Text>
          </View>
        </View>

        <Text className="text-xs text-beta/70 dark:text-light/70 mt-2" numberOfLines={2}>
          {description}
        </Text>

        <View className="flex-row items-center gap-2 mt-3">
          <Ionicons name="calendar-outline" size={14} color={accentIcon} />
          <Text className="text-xs font-semibold text-beta dark:text-alpha">View calendar</Text>
        </View>
      </View>
    </Pressable>
  );
}
