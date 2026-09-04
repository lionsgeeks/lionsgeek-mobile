import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { format, isValid, parseISO } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import AppLayout from '@/components/layout/AppLayout';
import Skeleton from '@/components/ui/Skeleton';
import { getAccentFillColor, getAccentIconColor } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useScrollTabPadding } from '@/hooks/useScrollTabPadding';
import API from '@/api';
import ReservationDetailHeader from './ReservationDetailHeader';
import { ReservationHistoryStatusBadge } from './reservationTheme';

function formatDayLabel(dayRaw) {
  if (!dayRaw) return '';
  const s = String(dayRaw).slice(0, 10);
  const d = parseISO(s);
  if (!isValid(d)) return String(dayRaw);
  return format(d, 'EEE, d MMM yyyy');
}

function bookingStatusLine(item) {
  if (item.canceled) return 'Cancelled';
  if (!item.approved) return 'Pending approval';
  return 'Approved';
}

function ReservationHistoryRow({ item, mode, onPress, isDark, accentIcon }) {
  const subtitleParts = [];
  if (item.day) subtitleParts.push(formatDayLabel(item.day));
  if (item.start && item.end) subtitleParts.push(`${item.start} – ${item.end}`);
  const studioOrDesk =
    mode === 'studio'
      ? item.studio_name || item.type || null
      : item.seats != null
        ? `${item.seats} seat${Number(item.seats) === 1 ? '' : 's'}`
        : null;
  if (studioOrDesk) subtitleParts.push(studioOrDesk);

  const status = bookingStatusLine(item);

  return (
    <Pressable
      onPress={onPress}
      className="mx-4 mb-3 bg-light dark:bg-dark border border-beta/10 dark:border-light/10 rounded-2xl overflow-hidden active:opacity-90"
    >
      <View className="flex-row items-start p-4">
        <View className="mr-3 w-10 h-10 rounded-full bg-beta/15 dark:bg-alpha/15 items-center justify-center">
          <Ionicons
            name={mode === 'studio' ? 'business-outline' : 'desktop-outline'}
            size={20}
            color={accentIcon}
          />
        </View>
        <View className="flex-1 min-w-0 pr-2">
          <Text className="text-base font-bold text-beta dark:text-light" numberOfLines={2}>
            {item.title || (mode === 'studio' ? 'Studio booking' : 'Coworking reservation')}
          </Text>
          {item.description && mode === 'studio' ? (
            <Text className="text-xs text-beta/60 dark:text-light/60 mt-1" numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
          <Text className="text-xs text-beta/70 dark:text-light/70 mt-2" numberOfLines={2}>
            {subtitleParts.filter(Boolean).join(' · ')}
          </Text>
          <View className="mt-2">
            <ReservationHistoryStatusBadge label={status} />
          </View>
        </View>
        <Ionicons
          name={mode === 'studio' ? 'chevron-forward' : 'information-circle-outline'}
          size={18}
          color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}
        />
      </View>
    </Pressable>
  );
}

export default function ReservationHistoryContent({ mode }) {
  const { token } = useAppContext();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const accentFill = getAccentFillColor(isDark);
  const accentIcon = getAccentIconColor(isDark);
  const scrollBottomPadding = useScrollTabPadding(24);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const endpoint = mode === 'studio' ? 'mobile/reservations' : 'mobile/reservationsCowork';
  const title = mode === 'studio' ? 'Studios history' : 'Coworking history';
  const subtitle =
    mode === 'studio'
      ? 'Your studio reservations · newest first'
      : 'Your desk & cowork bookings · newest first';

  const load = useCallback(
    async (isRefresh) => {
      if (!token) {
        setItems([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setError(null);
      if (!isRefresh) setLoading(true);
      try {
        const res = await API.getWithAuth(endpoint, token);
        const list = res?.data?.reservations ?? [];
        setItems(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('[RESERVATION_HISTORY]', mode, e);
        setError(mode === 'studio' ? 'Could not load studios history.' : 'Could not load coworking history.');
        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, endpoint, mode],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const onRowPress = useCallback(
    (item) => {
      if (mode === 'studio' && item?.id) {
        router.push(`/(tabs)/reservations/${item.id}`);
        return;
      }
      const lines = [
        formatDayLabel(item.day),
        item.start && item.end ? `${item.start} – ${item.end}` : null,
        bookingStatusLine(item),
        item.seats != null ? `Seats: ${item.seats}` : null,
        item.desk_id != null ? `Desk / spot id: ${item.desk_id}` : null,
      ]
        .filter(Boolean)
        .join('\n');
      Alert.alert(item.title || 'Coworking', lines || 'No details', [{ text: 'OK' }]);
    },
    [mode, router],
  );

  const listHeader = (
    <View>
      {error ? (
        <View className="mx-4 mb-3 rounded-2xl border border-error/20 bg-error/10 px-4 py-3">
          <Text className="text-center text-sm text-error">{error}</Text>
        </View>
      ) : null}
      <View className="px-4 pb-3 pt-1 border-b border-beta/10 dark:border-light/10 mb-2">
        <Text className="text-xs text-beta/50 dark:text-light/50">
          {items.length} booking{items.length === 1 ? '' : 's'}
        </Text>
      </View>
    </View>
  );

  const skeletonBlock = (
    <View className="pt-2">
      {Array.from({ length: 5 }).map((_, idx) => (
        <View
          key={idx}
          className="mx-4 mb-3 rounded-2xl border border-beta/10 dark:border-light/10 p-4"
        >
          <View className="flex-row items-center">
            <Skeleton width={40} height={40} borderRadius={20} isDark={isDark} />
            <View className="ml-3 flex-1">
              <Skeleton width="55%" height={14} borderRadius={8} isDark={isDark} />
              <View className="h-2" />
              <Skeleton width="85%" height={12} borderRadius={8} isDark={isDark} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );

  if (!token) {
    return (
      <AppLayout showNavbar={false} className="flex-1">
        <View className="flex-1 bg-light dark:bg-dark">
          <ReservationDetailHeader title={title} subtitle={subtitle} />
          <View className="flex-1 items-center justify-center px-6">
            <View className="w-16 h-16 rounded-2xl bg-beta/10 dark:bg-alpha/10 items-center justify-center mb-4">
              <Ionicons name="lock-closed-outline" size={32} color={accentIcon} />
            </View>
            <Text className="text-base font-semibold text-beta dark:text-light text-center">Sign in to continue</Text>
            <Text className="text-sm text-beta/55 dark:text-light/55 text-center mt-2">
              Reservation history is available after login.
            </Text>
          </View>
        </View>
      </AppLayout>
    );
  }

  const emptyState = (
    <View className="px-4 pt-2">
      <View className="items-center rounded-2xl border border-dashed border-beta/15 dark:border-light/15 py-16 px-6">
        <View className="w-16 h-16 rounded-2xl bg-beta/10 dark:bg-alpha/10 items-center justify-center">
          <Ionicons
            name={mode === 'studio' ? 'calendar-outline' : 'desktop-outline'}
            size={32}
            color={accentIcon}
          />
        </View>
        <Text className="mt-4 text-base font-semibold text-beta dark:text-light text-center">
          {mode === 'studio' ? 'Your studios history is empty.' : 'No coworking history yet.'}
        </Text>
        <Text className="mt-2 text-sm text-beta/55 dark:text-light/55 text-center">
          {mode === 'studio'
            ? 'Only your own studio reservations are listed here.'
            : 'Only coworking slots you booked appear here.'}
        </Text>
        <Pressable
          onPress={() => router.push('/(tabs)/reservations')}
          className="mt-6 rounded-xl bg-beta dark:bg-alpha px-6 py-3 active:opacity-80"
        >
          <Text className="text-sm font-bold text-light dark:text-beta">Open bookings</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <AppLayout showNavbar={false} className="flex-1">
      <View className="flex-1 bg-light dark:bg-dark">
        <ReservationDetailHeader title={title} subtitle={subtitle} />
        <FlatList
          data={items}
          keyExtractor={(row) => String(row.id)}
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={accentFill} colors={[accentFill]} />
          }
          ListHeaderComponent={listHeader}
          ListEmptyComponent={loading ? skeletonBlock : emptyState}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: 8,
            paddingBottom: scrollBottomPadding,
          }}
          renderItem={({ item }) => (
            <ReservationHistoryRow
              item={item}
              mode={mode}
              onPress={() => onRowPress(item)}
              isDark={isDark}
              accentIcon={accentIcon}
            />
          )}
        />
      </View>
    </AppLayout>
  );
}
