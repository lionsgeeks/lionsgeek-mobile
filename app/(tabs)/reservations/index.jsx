import { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import API from '@/api';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppLayout from '@/components/layout/AppLayout';
import { getAccentFillColor, getAccentIconColor } from '@/constants/Colors';
import Skeleton from '@/components/ui/Skeleton';
import PlaceCard from './Partials/PlaceCard';
import { useScrollTabPadding } from '@/hooks/useScrollTabPadding';

export default function Reservations() {
  const { token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const accentFill = getAccentFillColor(isDark);
  const accentIcon = getAccentIconColor(isDark);
  const scrollBottomPadding = useScrollTabPadding(24);

  const [allPlaces, setAllPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchPlaces = useCallback(async () => {
    if (!token) return;
    setLoadingPlaces(true);
    try {
      const response = await API.getWithAuth('places', token);
      if (response?.data) {
        const studios = (response.data?.studios || []).map((s) => ({ ...s, type: 'studio' }));
        const coworks = response.data?.coworks || [];
        const meetingRooms = (response.data?.meeting_rooms || response.data?.meetingRooms || []).map((m) => ({
          ...m,
          type: 'meeting',
        }));

        const coworkCard =
          coworks.length > 0
            ? [
                {
                  id: 'cowork-all',
                  name: 'Cowork',
                  description: 'Collaborative workspace with multiple tables',
                  type: 'cowork',
                  image: coworks[0]?.image || null,
                  allCoworks: coworks,
                },
              ]
            : [];

        setAllPlaces([...studios, ...coworkCard, ...meetingRooms]);
      }
    } catch (error) {
      console.error('[RESERVATIONS] Places Error:', error);
    } finally {
      setLoadingPlaces(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      setLoading(true);
      fetchPlaces().finally(() => setLoading(false));
    }
  }, [token, fetchPlaces]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPlaces();
    setRefreshing(false);
  }, [fetchPlaces]);

  const handlePlacePress = useCallback(
    (place) => {
      router.push({
        pathname: '/reservations/place-calendar',
        params: { place: JSON.stringify(place) },
      });
    },
    [router],
  );

  const loadingSkeleton = useMemo(
    () =>
      Array.from({ length: 3 }).map((_, idx) => (
        <View
          key={idx}
          className="mb-3 rounded-2xl overflow-hidden border border-beta/10 dark:border-light/10"
        >
          <Skeleton width="100%" height={128} borderRadius={0} isDark={isDark} />
          <View className="p-4 gap-2">
            <Skeleton width="60%" height={16} borderRadius={8} isDark={isDark} />
            <Skeleton width="90%" height={12} borderRadius={8} isDark={isDark} />
          </View>
        </View>
      )),
    [isDark],
  );

  if (loading && allPlaces.length === 0) {
    return (
      <AppLayout>
        <View className="flex-1 bg-light dark:bg-dark">
          <View className="px-4 pt-4 pb-2 border-b border-beta/10 dark:border-light/10">
            <Skeleton width={180} height={28} borderRadius={8} isDark={isDark} />
            <View className="h-2" />
            <Skeleton width={260} height={14} borderRadius={8} isDark={isDark} />
          </View>
          <View className="px-4 pt-4">{loadingSkeleton}</View>
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <View className="flex-1 bg-light dark:bg-dark">
        <View className="px-4 pt-4 pb-2 border-b border-beta/10 dark:border-light/10">
          <Text className="text-2xl font-bold text-beta dark:text-light">Reservations</Text>
          <Text className="text-sm text-beta/60 dark:text-light/60 mt-1">
            Book studios, cowork spaces, and meeting rooms
          </Text>
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="p-4"
          contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentFill} colors={[accentFill]} />
          }
        >
          {loadingPlaces ? (
            loadingSkeleton
          ) : allPlaces.length === 0 ? (
            <View className="items-center justify-center py-16 px-6">
              <View className="w-16 h-16 rounded-2xl bg-beta/10 dark:bg-alpha/10 items-center justify-center mb-4">
                <Ionicons name="business-outline" size={32} color={accentIcon} />
              </View>
              <Text className="text-base font-semibold text-beta dark:text-light text-center">
                No places available
              </Text>
              <Text className="text-sm text-beta/55 dark:text-light/55 text-center mt-2">
                Check back later for bookable spaces at LionsGeek.
              </Text>
            </View>
          ) : (
            allPlaces.map((place) => (
              <PlaceCard
                key={`${place.type}-${place.id}`}
                place={place}
                onPress={() => handlePlacePress(place)}
              />
            ))
          )}
        </ScrollView>
      </View>
    </AppLayout>
  );
}
