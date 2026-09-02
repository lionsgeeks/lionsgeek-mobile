import { useEffect, useState } from 'react';
import { View, Text, FlatList, Modal, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import API from '@/api';
import Skeleton from '@/components/ui/Skeleton';
import FollowUserRow from './FollowUserRow';

export default function FollowListModal({ visible, type, profileId, token, currentUserId, insets, isDark, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch only when the modal opens
  useEffect(() => {
    if (!visible || !profileId || !token) return;

    const endpoint = `mobile/profile/${profileId}/${type}`;
    setLoading(true);
    setError(null);
    setUsers([]);

    API.getWithAuth(endpoint, token)
      .then((res) => setUsers(res?.data?.data || []))
      .catch((err) => {
        console.error(`[PROFILE] ${type} fetch error:`, err);
        setError('Could not load list. Try again.');
      })
      .finally(() => setLoading(false));
  }, [visible, profileId, type, token]);

  const title = type === 'followers' ? 'Followers' : 'Following';

  const handleUserPress = (user) => {
    onClose();
    router.push({ pathname: '/(tabs)/profile', params: { userId: user.id } });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-light dark:bg-dark">
        {/* Header */}
        <View
          className="flex-row items-center px-4 bg-light dark:bg-dark border-b border-black/10 dark:border-white/10"
          style={{ paddingTop: insets.top + 10, paddingBottom: 10 }}
        >
          <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={26} color={isDark ? '#fff' : '#000'} />
          </TouchableOpacity>
          <Text className="ml-3 text-base font-bold text-black dark:text-white">{title}</Text>
        </View>

        {/* Content */}
        {loading ? (
          <View className="flex-1 px-4 pt-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <View key={i} className="flex-row items-center gap-3">
                <Skeleton width={48} height={48} borderRadius={24} isDark={isDark} />
                <View className="flex-1 gap-2">
                  <Skeleton width="55%" height={13} borderRadius={8} isDark={isDark} />
                  <Skeleton width="38%" height={10} borderRadius={8} isDark={isDark} />
                </View>
              </View>
            ))}
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="cloud-offline-outline" size={48} color={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'} />
            <Text className="text-black/50 dark:text-dark_gray0 mt-4 text-sm text-center">{error}</Text>
          </View>
        ) : users.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="people-outline" size={52} color={isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'} />
            <Text className="text-black/40 dark:text-white/40 mt-4 text-sm font-medium">
              No {title.toLowerCase()} yet
            </Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <FollowUserRow
                user={item}
                isDark={isDark}
                currentUserId={currentUserId}
                token={token}
                onPress={handleUserPress}
              />
            )}
            ItemSeparatorComponent={() => (
              <View className="h-px mx-4 bg-black/5 dark:bg-dark_gray" />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          />
        )}
      </View>
    </Modal>
  );
}
