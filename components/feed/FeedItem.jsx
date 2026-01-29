import { View, Text, Image, Pressable, TouchableOpacity } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import API from '@/api';

export default function FeedItem({ item, onPress }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const formatTime = (dateString) => {
    if (!dateString) return 'Just now';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 7) return date.toLocaleDateString();
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins > 0) return `${mins}m ago`;
    return 'Just now';
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'project':
        return 'folder-outline';
      case 'reservation':
        return 'calendar-outline';
      case 'achievement':
        return 'trophy';
      default:
        return 'document-outline';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'project':
        return '#f59e0b';
      case 'reservation':
        return '#10b981';
      case 'achievement':
        return '#ffc801';
      default:
        return isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
    }
  };

  // Helper function to get avatar URL - match profile.jsx and notifications.jsx approach
  const getAvatarUrl = () => {
    const avatar = item.user?.avatar || item.userAvatar;
    const image = item.user?.image;
    
    // First try avatar (might be full URL from API)
    const avatarValue = avatar || image;
    
    if (!avatarValue) return null;
    
    // If it's already a full URL, return it
    if (typeof avatarValue === 'string' && (avatarValue.startsWith('http://') || avatarValue.startsWith('https://'))) {
      return avatarValue;
    }
    
    if (typeof avatarValue === 'string') {
      // Check if it already includes storage path
      if (avatarValue.includes('storage/')) {
        const cleanPath = avatarValue.startsWith('/') ? avatarValue : `/${avatarValue}`;
        return `${API.APP_URL}${cleanPath}`;
      } else {
        // If it's just a filename, use storage/img/profile/ like profile.jsx does
        return `${API.APP_URL}/storage/img/profile/${avatarValue}`;
      }
    }
    
    return null;
  };

  return (
    <Pressable onPress={onPress} className="mb-4">
      <View className="bg-light dark:bg-dark rounded-2xl overflow-hidden border border-light/20 dark:border-dark/20 shadow-sm">
        {/* Header */}
        <View className="flex-row items-center p-4 pb-3">
          {(() => {
            const profileImageUrl = getAvatarUrl();
            
            console.log('[FeedItem] Profile image URL:', profileImageUrl, 'for user:', item.user?.name, 'avatar:', item.user?.avatar, 'image:', item.user?.image);
            
            return profileImageUrl ? (
              <Image
                source={{ uri: profileImageUrl }}
                className="w-14 h-14 rounded-full mr-3 border-2 border-alpha/30"
                defaultSource={require('@/assets/images/icon.png')}
                onError={(error) => {
                  console.log('[FeedItem] Error loading profile image:', profileImageUrl, error);
                }}
                onLoad={() => {
                  console.log('[FeedItem] Profile image loaded successfully:', profileImageUrl);
                }}
              />
            ) : (
              <View className="w-14 h-14 rounded-full mr-3 bg-beta/20 dark:bg-beta/40 items-center justify-center border-2 border-beta/30">
                <Ionicons 
                  name={getTypeIcon(item.type)} 
                  size={24} 
                  color={getTypeColor(item.type)} 
                />
              </View>
            );
          })()}
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className="font-bold text-base text-black dark:text-white">
                {item.user?.name || 'System'}
              </Text>
              {item.badge && (
                <View 
                  className="ml-2 px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: item.badgeColor || '#ef4444' }}
                >
                  <Text className="text-xs font-bold text-white">{item.badge}</Text>
                </View>
              )}
            </View>
            <View className="flex-row items-center mt-0.5">
              <Ionicons 
                name={getTypeIcon(item.type)} 
                size={12} 
                color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} 
              />
              <Text className="text-xs text-black/60 dark:text-white/60 ml-1">
                {formatTime(item.created_at)}
              </Text>
            </View>
          </View>
          <TouchableOpacity>
            <Ionicons name="ellipsis-horizontal" size={22} color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} />
          </TouchableOpacity>
        </View>

        {/* Content - Post Image */}
        {item.postImage && (() => {
          // postImage should already be a full URL from normalization
          const postImageUrl = item.postImage;
          console.log('[FeedItem] Post image URL:', postImageUrl, 'for post:', item.id);
          
          return (
            <Image
              source={{ uri: postImageUrl }}
              className="w-full h-64"
              resizeMode="cover"
              onError={(error) => {
                console.log('[FeedItem] Error loading post image:', postImageUrl, error);
              }}
              onLoad={() => {
                console.log('[FeedItem] Post image loaded successfully:', postImageUrl);
              }}
            />
          );
        })()}
        
        <View className="p-4 pt-3">
          <Text className="text-lg font-bold text-black dark:text-white mb-2">
            {item.title || 'New activity'}
          </Text>
          <Text className="text-sm text-black/80 dark:text-white/80 leading-6 mb-3" numberOfLines={3}>
            {item.description || 'No description available'}
          </Text>

          {/* Repost Indicator */}
          {item.reposted && (
            <View className="flex-row items-center px-3 py-2 bg-alpha/10 dark:bg-alpha/20 rounded-xl mb-3 border border-alpha/20">
              <Ionicons name="repeat" size={16} color="#ffc801" />
              <Text className="text-xs text-black/70 dark:text-white/70 ml-2 font-medium">
                Reposted by {item.reposted_by || 'someone'}
              </Text>
            </View>
          )}

          {/* Footer - Like, Comment, Repost, Share */}
          <View className="flex-row items-center justify-between pt-3 border-t border-light/20 dark:border-dark/20">
            <TouchableOpacity className="flex-row items-center px-4 py-2 rounded-xl active:opacity-80 hover:bg-light/50 dark:hover:bg-dark/50">
              <Ionicons name="heart-outline" size={22} color={isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)'} />
              <Text className="text-sm font-semibold text-black dark:text-white ml-2">
                {item.likes || 0}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center px-4 py-2 rounded-xl active:opacity-80 hover:bg-light/50 dark:hover:bg-dark/50">
              <Ionicons name="chatbubble-outline" size={22} color={isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)'} />
              <Text className="text-sm font-semibold text-black dark:text-white ml-2">
                {item.comments || 0}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                if (item.onRepost) {
                  item.onRepost(item);
                }
              }}
              className={`flex-row items-center px-4 py-2 rounded-xl active:opacity-80 ${item.isReposted ? 'bg-alpha/20' : ''}`}
            >
              <Ionicons 
                name={item.isReposted ? "repeat" : "repeat-outline"} 
                size={22} 
                color={item.isReposted ? '#ffc801' : (isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)')} 
              />
              <Text className={`text-sm font-semibold ml-2 ${item.isReposted ? 'text-alpha' : 'text-black dark:text-white'}`}>
                {item.reposts || 0}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-row items-center px-4 py-2 rounded-xl active:opacity-80">
              <Ionicons name="share-social-outline" size={22} color={isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
