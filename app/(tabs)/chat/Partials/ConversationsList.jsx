import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, Image, ScrollView, TextInput, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { useFocusEffect } from 'expo-router/react-navigation';
import { router } from 'expo-router';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getAccentFillColor, getAccentIconColor, getPlaceholderTextColor } from '@/constants/Colors';
import { useScrollTabPadding } from '@/hooks/useScrollTabPadding';
import API from '@/api';
import Skeleton from '@/components/ui/Skeleton';
import { userHasAdminRole } from '@/components/helpers/helpers';

function openChatThread(otherUserId, onBeforeNavigate) {
  const id = String(otherUserId ?? '').trim();
  if (!id) return;
  onBeforeNavigate?.();
  router.push(`/(tabs)/chat/${id}`);
}

function openGroupThread(conversationId, onBeforeNavigate) {
  const id = String(conversationId ?? '').trim();
  if (!id) return;
  onBeforeNavigate?.();
  router.push(`/(tabs)/chat/group/${id}`);
}

function parseStructuredBody(body) {
  if (!body) return null;
  if (typeof body === 'object') return body;
  if (typeof body !== 'string') return null;
  const trimmed = body.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export default function ConversationsList({ onUnreadCountChange, onBeforeNavigateToThread }) {
  const { user, token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const accentIcon = getAccentIconColor(isDark);
  const accentFill = getAccentFillColor(isDark);
  const placeholderColor = getPlaceholderTextColor(isDark);
  const scrollBottomPadding = useScrollTabPadding(24);
  const currentUser = user;
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [contextConversation, setContextConversation] = useState(null);
  const searchTimeoutRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await API.getWithAuth('mobile/chat', token);

      if (response && response.data) {
        const fetchedConversations = response.data.conversations || [];
        setConversations(fetchedConversations);

        const totalUnread = fetchedConversations.reduce(
          (sum, conv) => sum + (conv.unread_count || 0),
          0
        );
        onUnreadCountChange?.(totalUnread);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      setConversations([]);
      onUnreadCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [token, onUnreadCountChange]);

  useFocusEffect(
    useCallback(() => {
      fetchConversations();
    }, [fetchConversations])
  );

  const handleConversationClick = (conversation) => {
    if (conversation?.type === 'group') {
      openGroupThread(conversation.id, onBeforeNavigateToThread);
      return;
    }
    openChatThread(conversation?.other_user?.id, onBeforeNavigateToThread);
  };

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    setIsSearchingUsers(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await API.getWithAuth(
          `mobile/search?q=${encodeURIComponent(searchQuery)}&type=students`,
          token
        );

        if (response && response.data) {
          const users = response.data.results || [];
          const followingResponse = await API.getWithAuth('mobile/chat/following-ids', token);
          const followingIds = followingResponse?.data?.following_ids || [];

          const filteredUsers = users.filter(
            (u) => u.id !== currentUser.id && followingIds.includes(u.id)
          );
          setSearchResults(filteredUsers);
        }
      } catch (error) {
        console.error('Failed to search users:', error);
        setSearchResults([]);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 300);
  }, [searchQuery, currentUser?.id, token]);

  const viewerIsAdmin = userHasAdminRole(currentUser);
  const q = searchQuery.toLowerCase();
  const filteredConversations = conversations.filter((conv) => {
    if (conv.type === 'group') {
      return String(conv.name || '')
        .toLowerCase()
        .includes(q);
    }
    const nameMatch = conv.other_user?.name?.toLowerCase().includes(q);
    const emailMatch =
      viewerIsAdmin && conv.other_user?.email?.toLowerCase().includes(q);
    return nameMatch || emailMatch;
  });

  const handleUserSelect = (userId) => {
    setSearchQuery('');
    setSearchResults([]);
    openChatThread(userId, onBeforeNavigateToThread);
  };

  const handleDeleteConversation = async (conversationId) => {
    try {
      const response = await API.remove(`mobile/chat/conversation/${conversationId}`, token);
      if (response && response.status === 200) {
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        fetchConversations();
      } else {
        Alert.alert('Error', 'Failed to delete conversation');
      }
    } catch {
      Alert.alert('Error', 'Failed to delete conversation');
    } finally {
      setContextConversation(null);
    }
  };

  return (
    <View className="flex-1 bg-light dark:bg-dark">
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center rounded-2xl border border-beta/10 dark:border-light/10 bg-light dark:bg-dark px-3">
          <Ionicons name="search" size={18} color={placeholderColor} />
          <TextInput
            placeholder="Search conversations…"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 min-h-11 py-2 pl-2 text-sm text-beta dark:text-light"
            placeholderTextColor={placeholderColor}
            autoCorrect={false}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={8} className="p-1">
              <Ionicons name="close-circle" size={18} color={placeholderColor} />
            </Pressable>
          ) : null}
        </View>

        {searchQuery.trim() && searchResults.length > 0 ? (
          <View className="mt-3 rounded-2xl border border-beta/10 dark:border-light/10 overflow-hidden bg-light dark:bg-dark">
            <Text className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-beta/50 dark:text-light/50">
              Start a conversation
            </Text>
            <ScrollView className="max-h-56" nestedScrollEnabled>
              {searchResults.map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => handleUserSelect(u.id)}
                  className="flex-row items-center gap-3 px-3 py-3 border-t border-beta/10 dark:border-light/10 active:opacity-80"
                >
                  {u.image || u.avatar ? (
                    <Image
                      source={{
                        uri: `${API.APP_URL}/storage/img/profile/${u.image || u.avatar}`,
                      }}
                      className="h-11 w-11 rounded-2xl"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="h-11 w-11 rounded-2xl bg-beta/10 dark:bg-light/10 items-center justify-center">
                      <Ionicons name="person" size={18} color={accentIcon} />
                    </View>
                  )}
                  <View className="flex-1 min-w-0">
                    <Text
                      className="text-sm font-semibold text-beta dark:text-light"
                      numberOfLines={1}
                    >
                      {u.name}
                    </Text>
                    {viewerIsAdmin && u.email ? (
                      <Text
                        className="text-xs text-beta/50 dark:text-light/50"
                        numberOfLines={1}
                      >
                        {u.email}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={accentFill} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {searchQuery.trim() && isSearchingUsers ? (
          <View className="mt-3 items-center py-4">
            <Skeleton width={22} height={22} borderRadius={11} isDark={isDark} />
          </View>
        ) : null}
      </View>

      {!loading && filteredConversations.length > 0 ? (
        <Text className="px-4 pb-2 text-xs text-beta/50 dark:text-light/50">
          {filteredConversations.length} conversation
          {filteredConversations.length === 1 ? '' : 's'}
        </Text>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: scrollBottomPadding, paddingHorizontal: 16 }}
      >
        {loading ? (
          <View className="gap-3 pt-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width="100%" height={88} borderRadius={16} isDark={isDark} />
            ))}
          </View>
        ) : filteredConversations.length === 0 ? (
          <View className="mt-10 items-center px-6">
            <View className="w-16 h-16 rounded-2xl bg-beta/10 dark:bg-alpha/10 items-center justify-center mb-4">
              <Ionicons name="chatbubbles-outline" size={28} color={accentFill} />
            </View>
            <Text className="text-base font-semibold text-beta dark:text-light text-center">
              {searchQuery ? 'No matches' : 'No conversations yet'}
            </Text>
            <Text className="text-sm text-beta/60 dark:text-light/60 text-center mt-2 leading-5">
              {searchQuery
                ? 'Try another name, or follow someone first to message them.'
                : 'Search for someone you follow to start a conversation.'}
            </Text>
          </View>
        ) : (
          <View className="pt-1">
            {filteredConversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                currentUserId={currentUser?.id}
                accentIcon={accentIcon}
                onClick={() => handleConversationClick(conversation)}
                onLongPress={() => setContextConversation(conversation)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={Boolean(contextConversation)}
        transparent
        animationType="slide"
        onRequestClose={() => setContextConversation(null)}
      >
        <Pressable
          onPress={() => setContextConversation(null)}
          className="flex-1 bg-black/35 justify-end"
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full rounded-t-3xl bg-light dark:bg-dark border-t border-beta/10 dark:border-light/10 pb-4"
          >
            <View className="items-center pt-2 pb-1">
              <View className="w-10 h-1 rounded-full bg-beta/20 dark:bg-light/20" />
            </View>
            <View className="px-5 pt-3 pb-3 border-b border-beta/10 dark:border-light/10">
              <Text className="text-[10px] font-bold tracking-[0.2em] text-beta/45 dark:text-light/45 uppercase">
                {contextConversation?.type === 'group' ? 'Group' : 'Conversation'}
              </Text>
              <Text
                className="text-base font-semibold text-beta dark:text-light mt-1.5"
                numberOfLines={1}
              >
                {contextConversation?.type === 'group'
                  ? contextConversation?.name || 'Group'
                  : contextConversation?.other_user?.name || 'Conversation'}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                if (!contextConversation) return;
                setContextConversation(null);
                handleConversationClick(contextConversation);
              }}
              className="mx-4 mt-4 px-4 py-3.5 flex-row items-center rounded-2xl border border-beta/10 dark:border-light/10"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={accentIcon} />
              <Text className="ml-3 text-beta dark:text-light font-semibold">Open conversation</Text>
            </Pressable>
            {contextConversation?.type === 'group' ? (
              <Pressable
                onPress={() => {
                  const id = contextConversation?.id;
                  setContextConversation(null);
                  if (id) router.push(`/(tabs)/chat/group-info/${id}`);
                }}
                className="mx-4 mt-2 px-4 py-3.5 flex-row items-center rounded-2xl border border-beta/10 dark:border-light/10"
              >
                <Ionicons name="information-circle-outline" size={18} color={accentIcon} />
                <Text className="ml-3 text-beta dark:text-light font-semibold">Group info</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() =>
                contextConversation && handleDeleteConversation(contextConversation.id)
              }
              className="mx-4 mt-2 px-4 py-3.5 flex-row items-center rounded-2xl bg-error/10"
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text className="ml-3 text-error font-semibold">
                {contextConversation?.type === 'group' ? 'Leave / delete group' : 'Delete conversation'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setContextConversation(null)}
              className="mx-4 mt-2 px-4 py-3.5 rounded-2xl"
            >
              <Text className="text-beta/60 dark:text-light/60 font-semibold text-center">
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ConversationItem({ conversation, currentUserId, accentIcon, onClick, onLongPress }) {
  const unread = conversation.unread_count > 0;
  const isGroup = conversation.type === 'group';
  const otherUserName = isGroup
    ? conversation.name || 'Group'
    : conversation.other_user?.name || 'User';
  const timeShort = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })
        .replace('about ', '')
        .replace(' ago', '')
        .replace('less than a minute', 'now')
        .replace(' minutes', 'm')
        .replace(' minute', 'm')
        .replace(' hours', 'h')
        .replace(' hour', 'h')
        .replace(' days', 'd')
        .replace(' day', 'd')
        .replace(' weeks', 'w')
        .replace(' week', 'w')
        .replace(' months', 'mo')
        .replace(' month', 'mo')
    : '';

  const getLastMessagePreview = () => {
    if (!conversation.last_message) return isGroup ? 'New group' : 'Tap to open';
    const { body, attachment_type, sender_id } = conversation.last_message;
    const isFromCurrentUser = sender_id === currentUserId;
    const prefix = isFromCurrentUser ? 'You: ' : '';

    const structured = parseStructuredBody(body);
    if (structured?.type === 'post_share') return `${prefix}Shared a post`;
    if (structured?.type === 'story_reply') {
      return `${prefix}Replied to a story${structured.text ? `: ${String(structured.text).slice(0, 60)}` : ''}`;
    }

    if (attachment_type === 'image') return `${prefix}Photo`;
    if (attachment_type === 'audio') return `${prefix}Voice message`;
    if (attachment_type === 'video') {
      const name = String(conversation.last_message?.attachment_name || '');
      if (/\.(m4a|aac|caf|mp3|wav)$/i.test(name) || /voice-message|audio\./i.test(name)) {
        return `${prefix}Voice message`;
      }
      return `${prefix}Video`;
    }
    if (attachment_type === 'file') return `${prefix}File`;
    if (body && typeof body === 'string') {
      return prefix + (body.length > 80 ? `${body.substring(0, 80)}…` : body);
    }
    return `${prefix}Attachment`;
  };

  return (
    <Pressable
      onPress={onClick}
      onLongPress={onLongPress}
      delayLongPress={280}
      className={`mb-3 rounded-2xl overflow-hidden border active:opacity-90 ${
        unread
          ? 'border-alpha/50 bg-alpha/10 dark:bg-alpha/10'
          : 'border-beta/10 dark:border-light/10 bg-light dark:bg-dark'
      }`}
    >
      <View className="flex-row items-center p-4 gap-3">
        <View className="relative">
          {isGroup ? (
            <View className="h-14 w-14 rounded-2xl bg-alpha/20 items-center justify-center">
              <Ionicons name="people" size={24} color={accentIcon} />
            </View>
          ) : conversation.other_user?.image ? (
            <Image
              source={{
                uri: `${API.APP_URL}/storage/img/profile/${conversation.other_user.image}`,
              }}
              className="h-14 w-14 rounded-2xl"
              resizeMode="cover"
            />
          ) : (
            <View className="h-14 w-14 rounded-2xl bg-beta/10 dark:bg-light/10 items-center justify-center">
              <Text className="text-lg font-bold text-beta/40 dark:text-light/40">
                {(conversation.other_user?.name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          {unread ? (
            <View className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-alpha items-center justify-center border-2 border-light dark:border-dark">
              <Text className="text-[10px] font-extrabold text-beta">
                {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
              </Text>
            </View>
          ) : null}
        </View>

        <View className="flex-1 min-w-0">
          <View className="flex-row items-center justify-between gap-2">
            <Text
              className={`flex-1 text-base ${unread ? 'font-bold' : 'font-semibold'} text-beta dark:text-light`}
              numberOfLines={1}
            >
              {otherUserName}
            </Text>
            {timeShort ? (
              <Text
                className={`text-[11px] shrink-0 ${
                  unread ? 'text-alpha font-bold' : 'text-beta/50 dark:text-light/50'
                }`}
              >
                {timeShort}
              </Text>
            ) : null}
          </View>

          {isGroup ? (
            <Text className="text-[11px] text-beta/45 dark:text-light/45 mt-0.5">
              {conversation.members_count || conversation.participants?.length || 0} members
            </Text>
          ) : null}

          <View className="flex-row items-center gap-1.5 mt-1.5">
            {conversation.last_message?.attachment_type === 'image' ? (
              <Ionicons name="image-outline" size={13} color={accentIcon} />
            ) : conversation.last_message?.attachment_type === 'audio' ? (
              <Ionicons name="mic-outline" size={13} color={accentIcon} />
            ) : conversation.last_message?.attachment_type === 'video' ? (
              <Ionicons name="videocam-outline" size={13} color={accentIcon} />
            ) : conversation.last_message?.attachment_type === 'file' ? (
              <Ionicons name="document-outline" size={13} color={accentIcon} />
            ) : null}
            <Text
              className={`flex-1 text-xs leading-4 ${
                unread
                  ? 'text-beta/80 dark:text-light/80 font-medium'
                  : 'text-beta/60 dark:text-light/60'
              }`}
              numberOfLines={2}
            >
              {getLastMessagePreview()}
            </Text>
          </View>

          {unread ? (
            <View className="mt-2 self-start bg-alpha/20 px-2 py-0.5 rounded-full">
              <Text className="text-[10px] font-semibold text-beta dark:text-alpha">Unread</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
