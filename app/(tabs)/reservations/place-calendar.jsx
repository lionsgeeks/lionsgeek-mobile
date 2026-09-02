import { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import API from '@/api';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useScrollTabPadding } from '@/hooks/useScrollTabPadding';
import AppLayout from '@/components/layout/AppLayout';
import { getAccentFillColor, getAccentIconColor } from '@/constants/Colors';
import SectionCard from '@/components/ui/SectionCard';
import Skeleton from '@/components/ui/Skeleton';
import ReservationDetailHeader from './Partials/ReservationDetailHeader';
import { getReservationCalendarTheme } from './Partials/reservationTheme';
import EventCoverImage from '../events/Partials/EventCoverImage';

export default function PlaceCalendarScreen() {
  const { token } = useAppContext();
  const router = useRouter();
  const params = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const accentFill = getAccentFillColor(isDark);
  const accentIcon = getAccentIconColor(isDark);
  const scrollBottomPadding = useScrollTabPadding(24);

  const [reservations, setReservations] = useState([]);
  const [reservationsCowork, setReservationsCowork] = useState([]);
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.place) {
      try {
        setPlace(JSON.parse(params.place));
      } catch (e) {
        console.error('[PLACE_CALENDAR] Error parsing place:', e);
      }
    }
  }, [params.place]);

  useEffect(() => {
    const fetchReservations = async () => {
      if (!token) return;
      try {
        const [studiosRes, coworkRes] = await Promise.all([
          API.getWithAuth('mobile/reservations', token).catch(() => ({ data: { reservations: [] } })),
          API.getWithAuth('mobile/reservationsCowork', token).catch(() => ({ data: { reservations: [] } })),
        ]);
        setReservations(studiosRes?.data?.reservations || []);
        setReservationsCowork(coworkRes?.data?.reservations || []);
      } catch (error) {
        console.error('[PLACE_CALENDAR] Error fetching reservations:', error);
      } finally {
        setLoading(false);
      }
    };

    if (token && place) fetchReservations();
  }, [token, place]);

  const markedDates = useMemo(() => {
    if (!place) return {};
    const marked = {};
    const relevantReservations =
      place.type === 'cowork' || place.type === 'meeting' ? reservationsCowork : reservations;

    const markDate = (dateStr, canceled) => {
      if (!dateStr) return;
      const color = canceled ? (isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)') : accentFill;
      if (!marked[dateStr] || marked[dateStr].dotColor !== accentFill) {
        marked[dateStr] = { marked: true, dotColor: color };
      }
    };

    const parseDate = (r) => {
      const date = r.day || r.date;
      if (!date) return null;
      if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) return date;
      return new Date(date).toISOString().split('T')[0];
    };

    if (place.id === 'cowork-all' && place.allCoworks) {
      const coworkIds = place.allCoworks.map((c) => c.id);
      relevantReservations
        .filter(
          (r) =>
            coworkIds.includes(r.place_id) ||
            coworkIds.includes(r.cowork_id) ||
            coworkIds.includes(r.table_id),
        )
        .forEach((r) => markDate(parseDate(r), r.canceled));
    } else {
      relevantReservations
        .filter((r) => r.studio_id === place.id || r.place_id === place.id)
        .forEach((r) => markDate(parseDate(r), r.canceled));
    }

    return marked;
  }, [place, reservations, reservationsCowork, isDark, accentFill]);

  const handleDayPress = useCallback(
    (day) => {
      if (!place) return;
      const tab = place.type === 'cowork' || place.type === 'meeting' ? 'cowork' : 'studios';
      const relevantReservations =
        place.type === 'cowork' || place.type === 'meeting' ? reservationsCowork : reservations;

      router.push({
        pathname: '/reservations/day',
        params: {
          date: day.dateString,
          tab,
          place: JSON.stringify(place),
          ...(tab === 'cowork'
            ? { reservationsCowork: JSON.stringify(relevantReservations) }
            : { reservations: JSON.stringify(relevantReservations) }),
        },
      });
    },
    [place, reservations, reservationsCowork, router],
  );

  const getImageUrl = () => {
    if (!place?.image) return null;
    if (place.image.startsWith('http')) return place.image;
    return `${API.APP_URL || ''}/storage/${place.image}`;
  };

  const calendarTheme = useMemo(() => getReservationCalendarTheme(isDark), [isDark]);

  if (loading || !place) {
    return (
      <AppLayout>
        <View className="flex-1 bg-light dark:bg-dark">
          <ReservationDetailHeader title="Loading…" loading />
          <View className="p-4 gap-4">
            <Skeleton width="100%" height={160} borderRadius={20} isDark={isDark} />
            <Skeleton width="100%" height={320} borderRadius={16} isDark={isDark} />
          </View>
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <View className="flex-1 bg-light dark:bg-dark">
        <ReservationDetailHeader title={place.name} subtitle="Select a date to reserve" />

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="p-4 gap-4"
          contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
        >
          <View className="rounded-2xl overflow-hidden border border-beta/10 dark:border-light/10">
            <EventCoverImage uri={getImageUrl()} height={160} borderRadius={0} />
          </View>

          <SectionCard className="p-4">
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-8 h-8 rounded-lg bg-beta/15 dark:bg-alpha/15 items-center justify-center">
                <Ionicons name="calendar-outline" size={18} color={accentIcon} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-beta dark:text-light">Availability</Text>
                <Text className="text-xs text-beta/45 dark:text-light/45 mt-0.5">
                  Tap a date to view schedule or book
                </Text>
              </View>
            </View>
            <Calendar
              markedDates={markedDates}
              onDayPress={handleDayPress}
              enableSwipeMonths
              markingType="dot"
              hideExtraDays
              theme={calendarTheme}
              minDate={new Date().toISOString().split('T')[0]}
            />
          </SectionCard>

          {/* <View className="flex-row gap-3">
            <View className="flex-1 border rounded-xl p-3.5 bg-beta/12 dark:bg-alpha/12 border-beta/20 dark:border-alpha/20">
              <Text className="text-[10px] font-bold uppercase tracking-wide text-beta/45 dark:text-light/45">
                Bookings
              </Text>
              <Text className="text-2xl font-bold text-beta dark:text-light mt-1">
                {Object.keys(markedDates).length}
              </Text>
            </View>
            <View className="flex-1 border rounded-xl p-3.5 bg-good/12 border-good/20">
              <Text className="text-[10px] font-bold uppercase tracking-wide text-good/80">Space type</Text>
              <Text className="text-sm font-bold text-beta dark:text-light mt-2 capitalize">
                {place.type || 'Space'}
              </Text>
            </View>
          </View> */}
        </ScrollView>
      </View>
    </AppLayout>
  );
}
