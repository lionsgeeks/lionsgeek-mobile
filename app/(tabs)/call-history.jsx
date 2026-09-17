import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

function formatDuration(sec) {
  if (sec == null) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function statusLabel(status) {
  switch (status) {
    case 'missed':
      return 'Missed call';
    case 'rejected':
      return 'Call rejected';
    case 'cancelled':
      return 'Call cancelled';
    case 'ended':
      return 'Call ended';
    case 'accepted':
    case 'ongoing':
      return 'Connected';
    case 'ringing':
    case 'pending':
      return 'Calling...';
    default:
      return status || 'Call';
  }
}

export default function CallHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token, user } = useAppContext();
  const isDark = useColorScheme() === 'dark';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await API.getCallHistory(token);
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setItems(list);
    } catch (_) {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  const fg = isDark ? '#fff' : '#000';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';

  const renderItem = ({ item }) => {
    const me = Number(user?.id);
    const outgoing = Number(item.caller_id) === me;
    const peer = outgoing ? item.callee : item.caller;
    const avatar = peer?.image
      ? `${API.APP_URL}/storage/img/profile/${peer.image}`
      : null;
    const isVideo = item.type === 'video';
    const missed = item.status === 'missed' || item.status === 'rejected';

    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: 16,
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            overflow: 'hidden',
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {avatar ? (
            <Image source={{ uri: avatar }} style={{ width: 44, height: 44 }} />
          ) : (
            <Ionicons name="person" size={22} color={muted} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: missed ? '#e53935' : fg, fontWeight: '700', fontSize: 15 }}>
            {peer?.name || 'User'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <Ionicons
              name={isVideo ? 'videocam' : 'call'}
              size={12}
              color={missed ? '#e53935' : muted}
            />
            <Text style={{ color: missed ? '#e53935' : muted, fontSize: 12 }}>
              {outgoing ? 'Outgoing' : 'Incoming'} · {statusLabel(item.status)}
              {item.duration != null ? ` · ${formatDuration(item.duration)}` : ''}
            </Text>
          </View>
        </View>
        <Text style={{ color: muted, fontSize: 11 }}>{formatWhen(item.created_at)}</Text>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#0f0f0f' : '#fafafa', paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 12,
          gap: 8,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
          }}
        >
          <Ionicons name="chevron-back" size={22} color={fg} />
        </Pressable>
        <Text style={{ color: fg, fontSize: 18, fontWeight: '800' }}>Call history</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#ffc801" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor="#ffc801"
            />
          }
          ListEmptyComponent={
            <View style={{ padding: 32, alignItems: 'center' }}>
              <Ionicons name="call-outline" size={36} color={muted} />
              <Text style={{ color: muted, marginTop: 12, textAlign: 'center' }}>
                No calls yet.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
