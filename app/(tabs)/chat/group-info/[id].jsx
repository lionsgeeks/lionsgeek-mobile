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
  Modal,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import AppLayout from '@/components/layout/AppLayout';
import API from '@/api';
import { Colors, getAccentFillColor, getPlaceholderTextColor } from '@/constants/Colors';

function roleLabel(role) {
  if (role === 'owner') return 'Owner';
  if (role === 'admin') return 'Admin';
  return 'Member';
}

function MemberAvatar({ user, size = 44, textColor, isDark }) {
  if (user?.image) {
    return (
      <Image
        source={{ uri: `${API.APP_URL}/storage/img/profile/${user.image}` }}
        style={{ width: size, height: size, borderRadius: 12 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#eee',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: textColor, fontWeight: '800', fontSize: size * 0.36 }}>
        {(user?.name || '?').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export default function GroupInfoScreen() {
  const { token, user } = useAppContext();
  const params = useLocalSearchParams();
  const rawId = params.id;
  const groupId = useMemo(
    () => (Array.isArray(rawId) ? rawId[0] : rawId)?.toString().trim() ?? '',
    [rawId]
  );

  const isDark = useColorScheme() === 'dark';
  const accentFill = getAccentFillColor(isDark);
  const placeholderColor = getPlaceholderTextColor(isDark);
  const text = isDark ? '#fff' : '#111';
  const muted = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.48)';
  const hairline = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const cardBg = isDark ? Colors.card_dark : '#fff';

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState({});
  const [adding, setAdding] = useState(false);

  const myRole = group?.my_role || (group?.is_owner ? 'owner' : 'member');
  const canManage = myRole === 'owner' || myRole === 'admin';
  const participants = useMemo(() => {
    const list = Array.isArray(group?.participants) ? [...group.participants] : [];
    const rank = { owner: 0, admin: 1, member: 2 };
    list.sort((a, b) => {
      const ra = rank[a.role] ?? 3;
      const rb = rank[b.role] ?? 3;
      if (ra !== rb) return ra - rb;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
    return list;
  }, [group?.participants]);

  const memberIds = useMemo(
    () => new Set(participants.map((p) => Number(p.id))),
    [participants]
  );

  const loadGroup = useCallback(async () => {
    if (!token || !groupId) return;
    setLoading(true);
    try {
      const response = await API.getWithAuth(`mobile/chat/groups/${groupId}`, token);
      const conv = response?.data?.conversation;
      if (conv) {
        setGroup(conv);
        setNameDraft(conv.name || '');
      } else {
        setGroup(null);
      }
    } catch {
      setGroup(null);
    } finally {
      setLoading(false);
    }
  }, [token, groupId]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  const openAddMembers = async () => {
    setAddOpen(true);
    setSelected({});
    setQuery('');
    setContactsLoading(true);
    try {
      const response = await API.getWithAuth('mobile/chat/following-users', token);
      const users = response?.data?.users || [];
      setContacts(
        users.filter(
          (u) => Number(u.id) !== Number(user?.id) && !memberIds.has(Number(u.id))
        )
      );
    } catch {
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  };

  const selectedIds = useMemo(
    () => Object.keys(selected).filter((id) => selected[id]).map((id) => Number(id)),
    [selected]
  );

  const filteredContacts = useMemo(() => {
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

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      Alert.alert('Missing name', 'Group name cannot be empty.');
      return;
    }
    if (trimmed === group?.name) {
      setEditingName(false);
      return;
    }
    setBusy(true);
    try {
      const response = await API.put(`mobile/chat/groups/${groupId}`, token, { name: trimmed });
      const conv = response?.data?.conversation;
      if (conv) {
        setGroup(conv);
        setNameDraft(conv.name || trimmed);
      } else {
        setGroup((prev) => (prev ? { ...prev, name: trimmed } : prev));
      }
      setEditingName(false);
    } catch (e) {
      Alert.alert(
        'Error',
        e?.response?.data?.error || e?.response?.data?.message || 'Could not rename group.'
      );
    } finally {
      setBusy(false);
    }
  };

  const addMembers = async () => {
    if (selectedIds.length < 1) {
      Alert.alert('Add members', 'Select at least one person.');
      return;
    }
    setAdding(true);
    try {
      const response = await API.post(
        `mobile/chat/groups/${groupId}/members`,
        { member_ids: selectedIds },
        token
      );
      const conv = response?.data?.conversation;
      if (conv) setGroup(conv);
      else await loadGroup();
      setAddOpen(false);
    } catch (e) {
      Alert.alert(
        'Error',
        e?.response?.data?.error || e?.response?.data?.message || 'Could not add members.'
      );
    } finally {
      setAdding(false);
    }
  };

  const removeMember = (member) => {
    if (!member?.id) return;
    const isSelf = Number(member.id) === Number(user?.id);
    Alert.alert(
      isSelf ? 'Leave group' : 'Remove member',
      isSelf
        ? 'Are you sure you want to leave this group?'
        : `Remove ${member.name || 'this member'} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isSelf ? 'Leave' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const response = await API.remove(
                `mobile/chat/groups/${groupId}/members/${member.id}`,
                token
              );
              if (isSelf) {
                router.replace('/(tabs)/chat');
                return;
              }
              if (response?.data?.success !== false) {
                setGroup((prev) => {
                  if (!prev) return prev;
                  const nextParticipants = (prev.participants || []).filter(
                    (p) => Number(p.id) !== Number(member.id)
                  );
                  return {
                    ...prev,
                    participants: nextParticipants,
                    members_count: nextParticipants.length,
                  };
                });
              }
            } catch (e) {
              Alert.alert(
                'Error',
                e?.response?.data?.error ||
                  e?.response?.data?.message ||
                  'Could not update members.'
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const leaveGroup = () => {
    if (!user?.id) return;
    removeMember({ id: user.id, name: user.name });
  };

  const deleteGroup = () => {
    Alert.alert(
      'Delete group',
      'This permanently deletes the group for everyone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await API.remove(`mobile/chat/conversation/${groupId}`, token);
              router.replace('/(tabs)/chat');
            } catch (e) {
              Alert.alert(
                'Error',
                e?.response?.data?.error ||
                  e?.response?.data?.message ||
                  'Could not delete group.'
              );
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const onMemberPress = (member) => {
    const isSelf = Number(member.id) === Number(user?.id);
    const canRemoveOther =
      canManage && !isSelf && member.role !== 'owner' && Number(member.id) !== Number(group?.created_by);

    const buttons = [
      {
        text: 'View profile',
        onPress: () =>
          router.push({
            pathname: '/(tabs)/profile',
            params: { userId: String(member.id) },
          }),
      },
    ];

    if (isSelf) {
      buttons.push({ text: 'Leave group', style: 'destructive', onPress: leaveGroup });
    } else if (canRemoveOther) {
      buttons.push({
        text: 'Remove from group',
        style: 'destructive',
        onPress: () => removeMember(member),
      });
    }

    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(member.name || 'Member', undefined, buttons);
  };

  if (!token) {
    return (
      <AppLayout showNavbar>
        <View className="flex-1 items-center justify-center bg-light dark:bg-dark px-6">
          <Text className="text-black/60 dark:text-white/60 text-center">
            Please log in to access chat
          </Text>
        </View>
      </AppLayout>
    );
  }

  if (loading) {
    return (
      <AppLayout showNavbar={false}>
        <View className="flex-1 items-center justify-center bg-light dark:bg-dark">
          <ActivityIndicator color={accentFill} />
        </View>
      </AppLayout>
    );
  }

  if (!group) {
    return (
      <AppLayout showNavbar={false}>
        <View className="flex-1 items-center justify-center bg-light dark:bg-dark px-6">
          <Text className="text-black/80 dark:text-white/80 text-center mb-4">
            Could not load this group.
          </Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text className="text-alpha font-semibold">Go back</Text>
          </Pressable>
        </View>
      </AppLayout>
    );
  }

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
            backgroundColor: cardBg,
          }}
        >
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={24} color={text} />
          </Pressable>
          <Text style={{ flex: 1, color: text, fontSize: 18, fontWeight: '800' }}>Group info</Text>
          {busy ? <ActivityIndicator color={accentFill} /> : null}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
          <View
            style={{
              alignItems: 'center',
              paddingVertical: 20,
              marginBottom: 16,
              borderRadius: 18,
              backgroundColor: cardBg,
              borderWidth: 1,
              borderColor: hairline,
            }}
          >
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Ionicons name="people" size={32} color={text} />
            </View>

            {editingName ? (
              <View style={{ width: '100%', paddingHorizontal: 16 }}>
                <TextInput
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  autoFocus
                  maxLength={120}
                  placeholder="Group name"
                  placeholderTextColor={placeholderColor}
                  style={{
                    borderWidth: 1,
                    borderColor: hairline,
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
                    color: text,
                    fontSize: 16,
                    fontWeight: '700',
                    textAlign: 'center',
                    marginBottom: 10,
                  }}
                />
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                  <Pressable
                    onPress={() => {
                      setNameDraft(group.name || '');
                      setEditingName(false);
                    }}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: hairline,
                    }}
                  >
                    <Text style={{ color: muted, fontWeight: '700' }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={saveName}
                    disabled={busy}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: Colors.alpha,
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: '#111', fontWeight: '800' }}>Save</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <Text
                  style={{ color: text, fontSize: 20, fontWeight: '800', textAlign: 'center' }}
                  numberOfLines={2}
                >
                  {group.name || 'Group'}
                </Text>
                <Text style={{ color: muted, fontSize: 13, marginTop: 6 }}>
                  {group.members_count || participants.length} member
                  {(group.members_count || participants.length) === 1 ? '' : 's'}
                </Text>
                {canManage ? (
                  <Pressable
                    onPress={() => setEditingName(true)}
                    style={{
                      marginTop: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: hairline,
                    }}
                  >
                    <Ionicons name="pencil-outline" size={16} color={accentFill} />
                    <Text style={{ color: accentFill, fontWeight: '700', fontSize: 13 }}>
                      Rename group
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <Text style={{ flex: 1, color: muted, fontSize: 12, fontWeight: '700' }}>
              MEMBERS ({participants.length})
            </Text>
            {canManage ? (
              <Pressable
                onPress={openAddMembers}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 10,
                  backgroundColor: Colors.alpha,
                }}
              >
                <Ionicons name="person-add-outline" size={14} color="#111" />
                <Text style={{ color: '#111', fontWeight: '800', fontSize: 12 }}>Add</Text>
              </Pressable>
            ) : null}
          </View>

          {participants.map((member) => {
            const isSelf = Number(member.id) === Number(user?.id);
            return (
              <Pressable
                key={member.id}
                onPress={() => onMemberPress(member)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: hairline,
                  backgroundColor: cardBg,
                  marginBottom: 8,
                }}
              >
                <MemberAvatar user={member} textColor={text} isDark={isDark} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                    {member.name}
                    {isSelf ? ' (you)' : ''}
                  </Text>
                  <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                    {roleLabel(member.role)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={muted} />
              </Pressable>
            );
          })}

          <Text
            style={{
              color: muted,
              fontSize: 12,
              fontWeight: '700',
              marginTop: 18,
              marginBottom: 10,
            }}
          >
            OPTIONS
          </Text>

          <Pressable
            onPress={leaveGroup}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderRadius: 14,
              backgroundColor: 'rgba(239,68,68,0.1)',
              marginBottom: 8,
            }}
          >
            <Ionicons name="exit-outline" size={20} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 15 }}>Leave group</Text>
          </Pressable>

          {myRole === 'owner' ? (
            <Pressable
              onPress={deleteGroup}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 14,
                paddingHorizontal: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.35)',
                marginBottom: 8,
              }}
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 15 }}>
                  Delete group
                </Text>
                <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                  Removes the group for everyone
                </Text>
              </View>
            </Pressable>
          ) : null}
        </ScrollView>

        <Modal visible={addOpen} animationType="slide" onRequestClose={() => setAddOpen(false)}>
          <View style={{ flex: 1, backgroundColor: isDark ? Colors.dark : Colors.light }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingTop: Platform.OS === 'ios' ? 56 : 20,
                paddingBottom: 12,
                borderBottomWidth: 1,
                borderBottomColor: hairline,
                backgroundColor: cardBg,
              }}
            >
              <Pressable onPress={() => setAddOpen(false)} hitSlop={8} style={{ marginRight: 12 }}>
                <Ionicons name="close" size={24} color={text} />
              </Pressable>
              <Text style={{ flex: 1, color: text, fontSize: 18, fontWeight: '800' }}>
                Add members
              </Text>
              <Pressable
                onPress={addMembers}
                disabled={adding || selectedIds.length < 1}
                style={{
                  backgroundColor: Colors.alpha,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 10,
                  opacity: adding || selectedIds.length < 1 ? 0.5 : 1,
                }}
              >
                {adding ? (
                  <ActivityIndicator color="#111" />
                ) : (
                  <Text style={{ color: '#111', fontWeight: '800', fontSize: 13 }}>
                    Add ({selectedIds.length})
                  </Text>
                )}
              </Pressable>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                margin: 16,
                borderWidth: 1,
                borderColor: hairline,
                borderRadius: 12,
                paddingHorizontal: 12,
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

            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
              {contactsLoading ? (
                <ActivityIndicator color={accentFill} style={{ marginTop: 24 }} />
              ) : filteredContacts.length === 0 ? (
                <Text style={{ color: muted, textAlign: 'center', marginTop: 24 }}>
                  {contacts.length === 0
                    ? 'No more people to add. Follow someone first.'
                    : 'No matches.'}
                </Text>
              ) : (
                filteredContacts.map((u) => {
                  const on = !!selected[u.id];
                  return (
                    <Pressable
                      key={u.id}
                      onPress={() => setSelected((prev) => ({ ...prev, [u.id]: !prev[u.id] }))}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        paddingVertical: 10,
                        paddingHorizontal: 10,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: on ? Colors.alpha : hairline,
                        backgroundColor: cardBg,
                        marginBottom: 8,
                      }}
                    >
                      <MemberAvatar user={u} textColor={text} isDark={isDark} />
                      <Text style={{ flex: 1, color: text, fontWeight: '700', fontSize: 15 }}>
                        {u.name}
                      </Text>
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
        </Modal>
      </View>
    </AppLayout>
  );
}
