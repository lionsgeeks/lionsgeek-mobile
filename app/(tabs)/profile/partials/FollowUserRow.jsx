import { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import API from '@/api';
import { resolveAvatarUrl } from '@/components/helpers/helpers';

export default function FollowUserRow({ user, isDark, currentUserId, token, onPress }) {
  const avatarUrl = resolveAvatarUrl(user.avatar || user.image);
  const isSelf = Number(user.id) === Number(currentUserId);

  // Initialised from the API field; toggled optimistically on press.
  const [isFollowing, setIsFollowing] = useState(!!user.is_following);
  const [followLoading, setFollowLoading] = useState(false);

  const handleFollow = async () => {
    if (followLoading) return;
    const next = !isFollowing;
    setIsFollowing(next); // optimistic
    setFollowLoading(true);
    try {
      await API.postWithAuth(`mobile/users/${user.id}/follow`, {}, token);
    } catch (err) {
      console.error('[FOLLOW] error:', err);
      setIsFollowing(!next); // revert on failure
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3"
      onPress={() => onPress(user)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View className="w-12 h-12 rounded-full overflow-hidden bg-alpha/10 items-center justify-center mr-3">
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : (
          <Ionicons name="person" size={22} color={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'} />
        )}
      </View>

      {/* Info */}
      <View className="flex-1 mr-3">
        <Text className="text-sm font-semibold text-black dark:text-white" numberOfLines={1}>
          {user.name}
        </Text>
        {user.status ? (
          <Text className="text-xs text-black/50 dark:text-dark_gray0 mt-0.5" numberOfLines={1}>
            {user.status}
          </Text>
        ) : user.promo ? (
          <Text className="text-xs text-black/50 dark:text-dark_gray0 mt-0.5">Promo {user.promo}</Text>
        ) : null}
      </View>

      {/* Follow button — hidden for the current user's own row */}
      {!isSelf && (
        <Pressable
          onPress={handleFollow}
          disabled={followLoading}
          className={`px-4 py-1.5 rounded-lg ${isFollowing
            ? 'border border-black/20 dark:border-white/20 bg-transparent'
            : 'bg-alpha'
            }`}
          style={{ opacity: followLoading ? 0.5 : 1 }}
        >
          <Text
            className={`text-xs font-bold ${isFollowing ? 'text-black dark:text-white' : 'text-beta'
              }`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      )}
    </TouchableOpacity>
  );
}
