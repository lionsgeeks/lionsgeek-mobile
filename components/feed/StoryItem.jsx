import { View, Text, Pressable, Image } from 'react-native';
import { useColorScheme } from '@/hooks/useColorScheme';
import API from '@/api';

export default function StoryItem({ user, isOwn = false, onPress }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Helper function to get avatar URL - always use /storage/img/profile/
  const getAvatarUrl = () => {
    const avatar = user?.avatar;
    const image = user?.image;
    
    // First try avatar (might be full URL from API)
    const avatarValue = avatar || image;
    
    if (!avatarValue) return null;
    
    // If it's already a full URL, check if it needs to be corrected
    if (typeof avatarValue === 'string' && (avatarValue.startsWith('http://') || avatarValue.startsWith('https://'))) {
      // If it's a full URL but doesn't include img/profile/, extract filename and reconstruct
      if (avatarValue.includes('/storage/') && !avatarValue.includes('/storage/img/profile/')) {
        // Extract filename from URL (e.g., from http://.../storage/filename.jpg)
        const filename = avatarValue.split('/').pop();
        if (filename) {
          return `${API.APP_URL}/storage/img/profile/${filename}`;
        }
      }
      return avatarValue;
    }
    
    if (typeof avatarValue === 'string') {
      // If it includes storage/ but not img/profile/, extract filename
      if (avatarValue.includes('storage/') && !avatarValue.includes('img/profile/')) {
        // Extract filename (handle both /storage/filename.jpg and storage/filename.jpg)
        const parts = avatarValue.split('/');
        const filename = parts[parts.length - 1];
        if (filename) {
          return `${API.APP_URL}/storage/img/profile/${filename}`;
        }
      }
      // If it already includes img/profile/, use it as is
      if (avatarValue.includes('img/profile/')) {
        const cleanPath = avatarValue.startsWith('/') ? avatarValue : `/${avatarValue}`;
        return `${API.APP_URL}${cleanPath}`;
      }
      // If it's just a filename, use storage/img/profile/
      return `${API.APP_URL}/storage/img/profile/${avatarValue}`;
    }
    
    return null;
  };

  return (
    <Pressable onPress={onPress} className="items-center mr-4">
      <View className={`rounded-full p-0.5 ${isOwn ? 'bg-alpha' : 'bg-light/30 dark:bg-dark/30'}`}>
        <View className="bg-light dark:bg-dark rounded-full p-0.5">
          {(() => {
            const profileImageUrl = getAvatarUrl();
            
            console.log('[StoryItem] Profile image URL:', profileImageUrl, 'for user:', user?.name, 'avatar:', user?.avatar, 'image:', user?.image);
            
            return profileImageUrl ? (
              <Image
                source={{ uri: profileImageUrl }}
                className="w-16 h-16 rounded-full"
                defaultSource={require('@/assets/images/icon.png')}
                onError={(error) => {
                  console.log('[StoryItem] Error loading profile image:', profileImageUrl, error);
                }}
                onLoad={() => {
                  console.log('[StoryItem] Profile image loaded successfully:', profileImageUrl);
                }}
              />
            ) : (
              <View className="w-16 h-16 rounded-full bg-beta/20 dark:bg-beta/40 items-center justify-center">
                <Text className="text-xs font-bold text-black/60 dark:text-white/60">
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            );
          })()}
        </View>
      </View>
      <Text className="text-xs mt-1 text-black dark:text-white max-w-[70px]" numberOfLines={1}>
        {isOwn ? 'Your Story' : user?.name || 'User'}
      </Text>
    </Pressable>
  );
}

