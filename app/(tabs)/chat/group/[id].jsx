import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAppContext } from '@/context';
import AppLayout from '@/components/layout/AppLayout';
import ChatBox from '../Partials/ChatBox';
import ChatThreadSkeleton from '../Partials/ChatThreadSkeleton';
import API from '@/api';

export default function GroupChatThreadScreen() {
  const { token } = useAppContext();
  const params = useLocalSearchParams();
  const rawId = params.id;
  const groupId = useMemo(
    () => (Array.isArray(rawId) ? rawId[0] : rawId)?.toString().trim() ?? '',
    [rawId]
  );

  const [conversation, setConversation] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useFocusEffect(
    useCallback(() => {
      if (!token || !groupId) return undefined;

      let cancelled = false;
      setLoadError(null);

      (async () => {
        try {
          const response = await API.getWithAuth(`mobile/chat/groups/${groupId}`, token);
          if (cancelled) return;
          if (response?.data?.conversation) {
            setConversation(response.data.conversation);
          } else {
            setConversation(null);
            setLoadError('Could not open this group.');
          }
        } catch {
          if (!cancelled) {
            setConversation(null);
            setLoadError('Could not open this group.');
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [token, groupId])
  );

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

  if (!groupId) {
    return (
      <AppLayout showNavbar={false} skipTopInset>
        <View className="flex-1 items-center justify-center bg-light dark:bg-dark px-6">
          <Text className="text-black/60 dark:text-white/60 text-center">Invalid group link.</Text>
        </View>
      </AppLayout>
    );
  }

  if (loadError) {
    return (
      <AppLayout showNavbar={false} skipTopInset>
        <View className="flex-1 items-center justify-center bg-light dark:bg-dark px-6">
          <Text className="text-black/80 dark:text-white/80 text-center mb-4">{loadError}</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text className="text-alpha font-semibold">Go back</Text>
          </Pressable>
        </View>
      </AppLayout>
    );
  }

  if (!conversation) {
    return (
      <AppLayout showNavbar={false} skipTopInset>
        <ChatThreadSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout showNavbar={false} skipTopInset>
      <ChatBox conversation={conversation} onBack={() => router.back()} />
    </AppLayout>
  );
}
