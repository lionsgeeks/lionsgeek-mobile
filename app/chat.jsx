import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import ConversationsList from '@/components/chat/ConversationsList';
import { router } from 'expo-router';

export default function ChatScreen() {
  const { token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [unreadCount, setUnreadCount] = useState(0);
  const conversationsListRef = useRef(null);

  const handleUnreadCountChange = (count) => {
    setUnreadCount(count);
  };

  const handleCloseChat = () => {
    router.back();
  };

  if (!token) {
    return (
      <AppLayout showNavbar={true}>
        <View className="flex-1 items-center justify-center bg-light dark:bg-dark">
          <Text className="text-black/60 dark:text-white/60">Please log in to access chat</Text>
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout showNavbar={false}>
      <View className="flex-1 bg-light dark:bg-dark">
        {/* Header */}
        <View className="bg-light dark:bg-dark border-b border-light/20 dark:border-dark/20 pt-12 pb-4 px-6">
          <View className="flex-row items-center justify-between">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <Ionicons name="arrow-back" size={24} color={isDark ? '#fff' : '#000'} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-black dark:text-white">Messages</Text>
              {unreadCount > 0 && (
                <Text className="text-sm text-black/60 dark:text-white/60 mt-1">
                  {unreadCount} unread {unreadCount === 1 ? 'message' : 'messages'}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Conversations List - Full screen */}
        <View className="flex-1">
          <ConversationsList
            ref={conversationsListRef}
            onCloseChat={handleCloseChat}
            onUnreadCountChange={handleUnreadCountChange}
          />
        </View>
      </View>
    </AppLayout>
  );
}

