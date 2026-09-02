import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import API from '@/api';
import AppLayout from '@/components/layout/AppLayout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useScrollTabPadding } from '@/hooks/useScrollTabPadding';
import { useAppContext } from '@/context';
import { getAccentIconColor } from '@/constants/Colors';
import Skeleton from '@/components/ui/Skeleton';
import SectionCard from '@/components/ui/SectionCard';
import ReservationDetailHeader from './Partials/ReservationDetailHeader';
import { ReservationStatusBadge } from './Partials/reservationTheme';

function DetailRow({ label, value, isDark, accentIcon, icon }) {
  return (
    <View className="flex-row items-start gap-2 py-2 border-b border-beta/6 dark:border-light/6 last:border-b-0">
      <Ionicons name={icon} size={16} color={accentIcon} style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="text-[10px] font-bold uppercase tracking-wide text-beta/45 dark:text-light/45">
          {label}
        </Text>
        <Text className="text-sm font-semibold text-beta dark:text-light mt-0.5">{value || '—'}</Text>
      </View>
    </View>
  );
}

function Thumbnail({ uri, size = 48 }) {
  const [hasError, setHasError] = useState(false);
  if (!uri || hasError) {
    return (
      <View
        className="bg-beta/15 dark:bg-alpha/15 items-center justify-center rounded-xl"
        style={{ width: size, height: size }}
      >
        <Ionicons name="image-outline" size={size * 0.4} color="#888" />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: 12 }}
      resizeMode="cover"
      onError={() => setHasError(true)}
    />
  );
}

export default function ReservationDetails() {
  const { id } = useLocalSearchParams();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const accentIcon = getAccentIconColor(isDark);
  const scrollBottomPadding = useScrollTabPadding(24);
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAppContext();

  useEffect(() => {
    const fetchReservation = async () => {
      try {
        const res = await API.getWithAuth(`mobile/reservations/${id}`, token);
        setReservation(res.data.reservation);
      } catch (error) {
        console.error('Error fetching reservation:', error);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchReservation();
  }, [id, token]);

  const baseUrl = (API?.APP_URL || '').replace(/\/+$/, '');

  const getImageUri = (item) => {
    if (!item) return null;
    if (typeof item === 'string') {
      const cleaned = item.trim().replace(/^@+/, '');
      if (!cleaned) return null;
      if (/^https?:\/\//i.test(cleaned)) return cleaned;
      const path = cleaned.replace(/^\/+/, '');
      if (path.startsWith('storage/')) return `${baseUrl}/${path}`;
      if (path.startsWith('img/')) return `${baseUrl}/storage/${path}`;
      return `${baseUrl}/${path}`;
    }
    if (typeof item === 'object') {
      return item.url || item.uri || item.image || item.image_url || item.path || null;
    }
    return null;
  };

  const getApproverName = (res) => {
    if (!res) return null;
    const direct = res.approver_name || res.approved_by || res.approver || res.approverName;
    if (direct && typeof direct === 'string') return direct;
    if (res.approver && typeof res.approver === 'object') {
      return res.approver.name || res.approver.full_name || res.approver.username || null;
    }
    return null;
  };

  if (loading) {
    return (
      <AppLayout>
        <View className="flex-1 bg-light dark:bg-dark">
          <ReservationDetailHeader title="Loading…" loading />
          <View className="p-4 gap-4">
            <Skeleton width="100%" height={120} borderRadius={16} isDark={isDark} />
            <Skeleton width="100%" height={200} borderRadius={16} isDark={isDark} />
          </View>
        </View>
      </AppLayout>
    );
  }

  if (!reservation) {
    return (
      <AppLayout>
        <View className="flex-1 bg-light dark:bg-dark items-center justify-center px-6">
          <Text className="text-base font-semibold text-beta dark:text-light">Reservation not found</Text>
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <View className="flex-1 bg-light dark:bg-dark">
        <ReservationDetailHeader
          title={reservation.title || 'Reservation'}
          subtitle={reservation.day ? `${reservation.day}${reservation.start ? ` · ${reservation.start}` : ''}` : undefined}
        />

        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 gap-4"
          contentContainerStyle={{ paddingBottom: scrollBottomPadding }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row flex-wrap gap-2">
            <ReservationStatusBadge status={reservation.status} />
            {reservation.type ? (
              <View className="bg-beta/15 dark:bg-alpha/15 px-2.5 py-1 rounded-full">
                <Text className="text-[10px] font-semibold text-beta dark:text-alpha uppercase">
                  {reservation.type}
                </Text>
              </View>
            ) : null}
          </View>

          {reservation.description ? (
            <SectionCard className="p-4">
              <Text className="text-base font-bold text-beta dark:text-light mb-2">Description</Text>
              <Text className="text-sm text-beta/80 dark:text-light/80 leading-6">{reservation.description}</Text>
            </SectionCard>
          ) : null}

          <SectionCard className="p-4">
            <View className="flex-row items-center gap-2 mb-3">
              <View className="w-8 h-8 rounded-lg bg-beta/15 dark:bg-alpha/15 items-center justify-center">
                <Ionicons name="time-outline" size={16} color={accentIcon} />
              </View>
              <Text className="text-base font-bold text-beta dark:text-light">Schedule</Text>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1 border rounded-xl p-3 bg-beta/12 dark:bg-alpha/12 border-beta/20 dark:border-alpha/20">
                <Text className="text-[10px] font-bold uppercase tracking-wide text-beta/45 dark:text-light/45">Date</Text>
                <Text className="text-lg font-bold text-beta dark:text-light mt-1">{reservation.day || '—'}</Text>
              </View>
              <View className="flex-1 border rounded-xl p-3 bg-beta/12 dark:bg-alpha/12 border-beta/20 dark:border-alpha/20">
                <Text className="text-[10px] font-bold uppercase tracking-wide text-beta/45 dark:text-light/45">Time</Text>
                <Text className="text-sm font-bold text-beta dark:text-light mt-1">
                  {reservation.start && reservation.end ? `${reservation.start} – ${reservation.end}` : '—'}
                </Text>
              </View>
            </View>
            <View className="mt-3">
              <DetailRow
                label="Studio"
                value={reservation.studio_name}
                isDark={isDark}
                accentIcon={accentIcon}
                icon="business-outline"
              />
              <DetailRow
                label="Approved by"
                value={
                  getApproverName(reservation) ||
                  (String(reservation.status || '').toLowerCase().includes('pending') ? 'Pending' : '—')
                }
                isDark={isDark}
                accentIcon={accentIcon}
                icon="checkmark-circle-outline"
              />
            </View>
          </SectionCard>

          <SectionCard className="p-4">
            <Text className="text-base font-bold text-beta dark:text-light mb-3">Equipment</Text>
            {Array.isArray(reservation.equipments) && reservation.equipments.length > 0 ? (
              reservation.equipments.map((eq, idx) => (
                <View
                  key={eq.id ?? idx}
                  className="flex-row items-center justify-between py-3 border-b border-beta/6 dark:border-light/6 last:border-b-0"
                >
                  <View className="flex-row items-center gap-3 flex-1 pr-2">
                    <Thumbnail uri={getImageUri(eq?.image)} size={48} />
                    <Text className="text-sm font-semibold text-beta dark:text-light flex-1" numberOfLines={1}>
                      {eq.name}
                    </Text>
                  </View>
                  <View className="bg-beta/10 dark:bg-light/10 px-2.5 py-1 rounded-full">
                    <Text className="text-[10px] font-semibold text-beta/70 dark:text-light/70">{eq.type_name}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View className="items-center py-8 border border-dashed border-beta/15 dark:border-light/15 rounded-xl">
                <Ionicons name="construct-outline" size={28} color={accentIcon} />
                <Text className="text-sm text-beta/55 dark:text-light/55 mt-2">No equipment listed</Text>
              </View>
            )}
          </SectionCard>

          {Array.isArray(reservation.images) && reservation.images.length > 0 ? (
            <SectionCard className="p-4">
              <Text className="text-base font-bold text-beta dark:text-light mb-3">Images</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
                {reservation.images.map((img, idx) => {
                  const uri = getImageUri(img);
                  if (!uri) return null;
                  return (
                    <View key={idx} className="rounded-xl overflow-hidden border border-beta/10 dark:border-light/10">
                      <Thumbnail uri={uri} size={160} />
                    </View>
                  );
                })}
              </ScrollView>
            </SectionCard>
          ) : null}

          <SectionCard className="p-4">
            <Text className="text-base font-bold text-beta dark:text-light mb-3">Team members</Text>
            {Array.isArray(reservation.members) && reservation.members.length > 0 ? (
              reservation.members.map((member, idx) => (
                <View
                  key={`${member.email}-${idx}`}
                  className="flex-row items-center justify-between py-3 border-b border-beta/6 dark:border-light/6 last:border-b-0"
                >
                  <View className="flex-row items-center gap-3 flex-1 pr-2">
                    <Thumbnail uri={member.avatar} size={44} />
                    <Text className="text-sm font-semibold text-beta dark:text-light flex-1" numberOfLines={1}>
                      {member.name}
                    </Text>
                  </View>
                  <View className="bg-beta/10 dark:bg-light/10 px-2.5 py-1 rounded-full">
                    <Text className="text-[10px] font-semibold text-beta/70 dark:text-light/70">{member.role}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View className="items-center py-8 border border-dashed border-beta/15 dark:border-light/15 rounded-xl">
                <Ionicons name="people-outline" size={28} color={accentIcon} />
                <Text className="text-sm text-beta/55 dark:text-light/55 mt-2">No team members listed</Text>
              </View>
            )}
          </SectionCard>
        </ScrollView>
      </View>
    </AppLayout>
  );
}
