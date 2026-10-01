import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppLayout from '@/components/layout/AppLayout';
import API from '@/api';
import { Colors, getAccentFillColor, getPlaceholderTextColor } from '@/constants/Colors';

export default function CreateGroupScreen() {
  const { token, user } = useAppContext();
  const isDark = useColorScheme() === 'dark';
  const accentFill = getAccentFillColor(isDark);
  const placeholderColor = getPlaceholderTextColor(isDark);
  const text = isDark ? '#fff' : '#111';
  const muted = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.48)';
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadContacts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await API.getWithAuth('mobile/chat/following-users', token);
      const users = response?.data?.users || [];
      setContacts(users.filter((u) => Number(u.id) !== Number(user?.id)));
    } catch (e) {
      console.error('[CREATE GROUP]', e);
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [token, user?.id]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]).map((id) => Number(id)),
    [selected]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (u) =>
        String(u.name || '')
          .toLowerCase()
          .includes(q) ||
        String(u.email || '')
          .toLowerCase()
          .includes(q)
    );
  }, [contacts, query]);

  const toggle = (id) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Missing name', 'Give your group a name.');
      return;
    }
    if (selectedIds.length < 1) {
      Alert.alert('Add members', 'Select at least one person you follow.');
      return;
    }
    setSaving(true);
    try {
      const response = await API.post(
        'mobile/chat/groups',
        { name: trimmed, member_ids: selectedIds },
        token
      );
      const groupId = response?.data?.conversation?.id;
      if (groupId) {
        router.replace(`/(tabs)/chat/group/${groupId}`);
      } else {
        router.back();
      }
    } catch (e) {
      Alert.alert(
        'Error',
        e?.response?.data?.error || e?.response?.data?.message || e?.message || 'Could not create group.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout showNavbar={false}>
      <View className="flex-1 bg-light dark:bg-dark">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: hairline,
            backgroundColor: isDark ? Colors.card_dark : '#fff',
          }}
        >
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={text} />
          </Pressable>
          <Text style={{ flex: 1, color: text, fontSize: 18, fontWeight: '800' }}>New group</Text>
          <Pressable
            onPress={create}
            disabled={saving}
            style={{
              backgroundColor: Colors.alpha,
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 10,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? (
              <ActivityIndicator color="#111" />
            ) : (
              <Text style={{ color: '#111', fontWeight: '800', fontSize: 13 }}>Create</Text>
            )}
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <Text style={{ color: muted, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
            GROUP NAME
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Weekend crew"
            placeholderTextColor={placeholderColor}
            style={{
              borderWidth: 1,
              borderColor: hairline,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: Platform.OS === 'ios' ? 12 : 10,
              color: text,
              fontSize: 15,
              fontWeight: '600',
              marginBottom: 18,
            }}
          />

          <Text style={{ color: muted, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
            MEMBERS ({selectedIds.length} selected)
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              borderWidth: 1,
              borderColor: hairline,
              borderRadius: 12,
              paddingHorizontal: 12,
              marginBottom: 12,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
            }}
          >
            <Ionicons name="search" size={16} color={muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search people you follow"
              placeholderTextColor={placeholderColor}
              style={{
                flex: 1,
                color: text,
                fontSize: 14,
                paddingVertical: Platform.OS === 'ios' ? 11 : 8,
              }}
            />
          </View>

          {loading ? (
            <ActivityIndicator color={accentFill} style={{ marginTop: 24 }} />
          ) : filtered.length === 0 ? (
            <Text style={{ color: muted, textAlign: 'center', marginTop: 24 }}>
              {contacts.length === 0
                ? 'Follow people first to add them to a group.'
                : 'No matches.'}
            </Text>
          ) : (
            filtered.map((u) => {
              const on = !!selected[u.id];
              return (
                <Pressable
                  key={u.id}
                  onPress={() => toggle(u.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 10,
                    paddingHorizontal: 10,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: on ? Colors.alpha : hairline,
                    backgroundColor: isDark ? Colors.card_dark : '#fff',
                    marginBottom: 8,
                  }}
                >
                  {u.image ? (
                    <Image
                      source={{ uri: `${API.APP_URL}/storage/img/profile/${u.image}` }}
                      style={{ width: 42, height: 42, borderRadius: 12 }}
                    />
                  ) : (
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 12,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#eee',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: text, fontWeight: '800' }}>
                        {(u.name || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                      {u.name}
                    </Text>
                  </View>
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={on ? Colors.alpha : muted}
                  />
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    </AppLayout>
  );
}
