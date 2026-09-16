import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Platform,
  StatusBar as RNStatusBar,
  Alert,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';

const GOLD = '#ffc801';
const TOP_INSET = (Platform.OS === 'ios' ? 54 : RNStatusBar.currentHeight ?? 24) + 6;

/**
 * Close Friends manager.
 *
 * Lets the auth user pick who's on their close-friends list. The candidate
 * pool is "people you follow" (so we don't expose strangers). Tapping a
 * row toggles membership with optimistic state updates.
 */
export default function CloseFriendsScreen() {
  const { token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState([]);
  const [pendingIds, setPendingIds] = useState(() => new Set());
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await API.listCloseFriends(token);
      const closeIds = new Set((data?.close_friends || []).map((u) => u.id));
      const list = (data?.candidates || []).map((u) => ({
        ...u,
        is_close: closeIds.has(u.id),
      }));
      // Also include close-friends that aren't in candidates (e.g. we unfollowed).
      const candIds = new Set(list.map((u) => u.id));
      (data?.close_friends || []).forEach((u) => {
        if (!candIds.has(u.id)) list.push({ ...u, is_close: true });
      });
      setCandidates(list);
    } catch (_) {
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async (u) => {
    if (!token || pendingIds.has(u.id)) return;
    const wasClose = u.is_close;
    setPendingIds((s) => new Set(s).add(u.id));
    // Optimistic flip
    setCandidates((prev) => prev.map((x) => x.id === u.id ? { ...x, is_close: !wasClose } : x));
    try {
      if (wasClose) {
        await API.removeCloseFriend(u.id, token);
      } else {
        await API.addCloseFriend(u.id, token);
      }
    } catch (e) {
      // Revert on failure
      setCandidates((prev) => prev.map((x) => x.id === u.id ? { ...x, is_close: wasClose } : x));
      Alert.alert('Error', e?.message || 'Could not update close friends.');
    } finally {
      setPendingIds((s) => { const n = new Set(s); n.delete(u.id); return n; });
    }
  }, [token, pendingIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((u) => (u.name || '').toLowerCase().includes(q));
  }, [candidates, query]);

  const closeCount = candidates.filter((u) => u.is_close).length;
  const bg = isDark ? '#0a0a0a' : '#f7f7f7';
  const card = isDark ? '#161616' : '#ffffff';
  const text = isDark ? '#fff' : '#111';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)';
  const hairline = isDark ? 'rgba(255,200,1,0.18)' : 'rgba(0,0,0,0.08)';

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <View style={[styles.header, { paddingTop: TOP_INSET, borderBottomColor: hairline, backgroundColor: isDark ? '#111' : '#fff' }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 }}>
            Close Friends
          </Text>
          <Text style={{ color: muted, fontSize: 12, marginTop: 2, fontWeight: '600' }}>
            {closeCount} {closeCount === 1 ? 'person' : 'people'} on your list
          </Text>
        </View>
        <View style={styles.badge}>
          <Ionicons name="star" size={12} color="#111" />
          <Text style={styles.badgeText}>{closeCount}</Text>
        </View>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : '#fff', borderColor: hairline }]}>
        <Ionicons name="search" size={16} color={GOLD} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search friends"
          placeholderTextColor={muted}
          style={{ flex: 1, color: text, fontSize: 15, paddingVertical: 0, fontWeight: '600' }}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={muted} />
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.helper, { color: muted }]}>
        People you add can see stories you share to Close Friends. They won't be notified when you add or remove them.
      </Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={GOLD} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={[styles.centered, { paddingHorizontal: 28 }]}>
          <View style={styles.emptyIcon}>
            <Ionicons name="people-outline" size={28} color="#111" />
          </View>
          <Text style={{ color: muted, marginTop: 14, textAlign: 'center', fontWeight: '600', lineHeight: 20 }}>
            {query
              ? 'No matches.'
              : 'Follow people first to add them to your close-friends list.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 36, gap: 8 }}>
          {filtered.map((u) => {
            const selected = !!u.is_close;
            const pending = pendingIds.has(u.id);
            return (
              <Pressable
                key={u.id}
                onPress={() => toggle(u)}
                disabled={pending}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: card,
                    borderColor: selected ? GOLD : hairline,
                    opacity: pressed || pending ? 0.72 : 1,
                  },
                ]}
              >
                <View style={[styles.avatar, { borderColor: selected ? GOLD : 'transparent' }]}>
                  {u.avatar ? (
                    <Image source={{ uri: u.avatar }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    <View style={[styles.avatarFallback, { backgroundColor: isDark ? '#222' : '#eee' }]}>
                      <Text style={{ color: text, fontWeight: '800', fontSize: 16 }}>
                        {(u.name || 'U').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={{ color: text, fontWeight: '800', fontSize: 15 }} numberOfLines={1}>
                    {u.name}
                  </Text>
                  <Text style={{ color: muted, fontSize: 12, marginTop: 2, fontWeight: '600' }}>
                    {selected ? 'On your Close Friends list' : 'Tap to add'}
                  </Text>
                </View>
                <View style={[styles.check, selected ? styles.checkOn : styles.checkOff]}>
                  {pending ? (
                    <ActivityIndicator size="small" color={selected ? '#111' : GOLD} />
                  ) : selected ? (
                    <Ionicons name="checkmark" size={16} color="#111" />
                  ) : (
                    <Ionicons name="add" size={16} color={GOLD} />
                  )}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: GOLD,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    color: '#111',
    fontSize: 12,
    fontWeight: '800',
  },
  searchWrap: {
    marginHorizontal: 14,
    marginTop: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  helper: {
    paddingHorizontal: 18,
    paddingBottom: 12,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    borderWidth: 2,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  checkOn: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  checkOff: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,200,1,0.55)',
  },
});
