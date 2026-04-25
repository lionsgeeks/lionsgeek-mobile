import { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator, Alert, TouchableOpacity, Image, Pressable } from 'react-native';
import { useAppContext } from '@/context';
import StoryItem from '@/components/feed/StoryItem';
import FeedItem from '@/components/feed/FeedItem';
import CreatePost from '@/components/feed/CreatePost';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import AppLayout from '@/components/layout/AppLayout';
import API from '@/api';
import { router } from 'expo-router';

export default function HomeScreen() {
  const { user, token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [posts, setPosts] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalHours: 0, streak: 0, rank: 0 });

  // Enhanced hardcoded posts
  const hardcodedPosts = [

    {
      id: 4,
      type: 'post',
      title: '📚 Workshop Announcement',
      description: 'Join us for an exciting workshop on modern web development next week! Limited spots available.',
      created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      user: {
        name: 'Nabil SAKR',
        avatar: 'https://via.placeholder.com/40',
        image: null,
      },
      likes: 45,
      comments: 8,
      reposts: 7,
      isReposted: true,
      reposted: true,
      reposted_by: user?.name || 'You',
      image: 'https://via.placeholder.com/400x200',
    },
  ];

  useEffect(() => {
    if (token) {
      fetchFeed();
    } else {
      setPosts(hardcodedPosts);
      setLoading(false);
    }
    // Simulate stats
    setStats({ totalHours: 127, streak: 7, rank: 5 });
  }, [token]);

  // Helper function to get avatar URL - match profile.jsx and notifications.jsx approach
  const getAvatarUrl = (avatar, image) => {
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

  const fetchFeed = async () => {
    if (!token) {
      setPosts(hardcodedPosts);
      setLoading(false);
      return;
    }
    
    try {
      console.log('[HOME] Fetching feed...');
      const response = await API.getWithAuth('mobile/feed', token);
      console.log('[HOME] Feed response:', JSON.stringify(response?.data, null, 2));
      
      if (response?.data) {
        // API returns { feed: [...] }, not { posts: [...] }
        const feedData = response.data.feed || response.data.posts || [];
        console.log('[HOME] Feed items found:', feedData.length);
        
        const feedPosts = feedData.map(post => {
          // Get user avatar and image from various possible fields
          const userAvatar = post.user?.avatar || post.author?.avatar || post.user_avatar || post.author_avatar;
          const userImage = post.user?.image || post.author?.image || post.user_image || post.author_image;
          
          // Construct proper avatar URL using helper function
          const avatarUrl = getAvatarUrl(userAvatar, userImage);
          
          const normalizedUser = {
            ...(post.user || post.author || {}),
            name: post.user?.name || post.author?.name || post.user_name || post.author_name || 'Unknown',
            avatar: avatarUrl,
            image: userImage, // Keep original image value for reference
          };
          
          // Post image handling - check if it needs URL construction
          let normalizedImage = post.image || post.image_url || post.media?.url || (post.images && post.images[0]);
          
          // If post image is not a full URL, construct it
          if (normalizedImage && typeof normalizedImage === 'string' && !normalizedImage.startsWith('http')) {
            if (normalizedImage.includes('storage/')) {
              const cleanPath = normalizedImage.startsWith('/') ? normalizedImage : `/${normalizedImage}`;
              normalizedImage = `${API.APP_URL}${cleanPath}`;
            } else {
              // Assume it's in /storage/img/posts/
              normalizedImage = `${API.APP_URL}/storage/img/posts/${normalizedImage}`;
            }
          }
          
          // Log for debugging
          console.log('[HOME] Post normalized:', {
            id: post.id,
            userName: normalizedUser.name,
            userAvatar: avatarUrl,
            userImage: userImage,
            postImage: normalizedImage,
            originalPostImage: post.image || post.image_url,
            fullUserObject: normalizedUser
          });
          
          return {
            ...post,
            user: normalizedUser,
            userAvatar: avatarUrl,
            postImage: normalizedImage,
            image: normalizedImage, // Keep for backward compatibility
            onRepost: handleRepost,
          };
        });
        setPosts(feedPosts);
      } else {
        // Fallback to hardcoded posts if no data
        setPosts(hardcodedPosts);
      }
    } catch (error) {
      console.error('[HOME] Error fetching feed:', error);
      // Fallback to hardcoded posts on error
      setPosts(hardcodedPosts);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeed();
  };

  const handleRepost = async (post) => {
    if (!token) {
      Alert.alert('Error', 'Authentication required');
      return;
    }

    try {
      const response = await API.post('mobile/posts/repost', {
        post_id: post.id,
      }, token);

      if (response?.data) {
        setPosts(prevPosts =>
          prevPosts.map(p =>
            p.id === post.id
              ? {
                  ...p,
                  isReposted: true,
                  reposts: (p.reposts || 0) + 1,
                  reposted: true,
                  reposted_by: user?.name || 'You',
                }
              : p
          )
        );
        Alert.alert('Success', 'Post reposted!');
      }
    } catch (error) {
      console.error('[HOME] Error reposting:', error);
      Alert.alert('Error', 'Failed to repost. Please try again.');
    }
  };

  const handlePostCreated = (newPost) => {
    setPosts(prevPosts => [
      {
        ...newPost,
        onRepost: handleRepost,
      },
      ...prevPosts,
    ]);
  };

  return (
    <AppLayout showNavbar={true}>
      <ScrollView 
        className="flex-1 bg-light dark:bg-dark"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffc801" />
        }
      >
          {/* Stories Section — padded */}
        <View className="px-4 pt-2 mb-2">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-bold text-black/80 dark:text-white/80 tracking-wide uppercase">Stories</Text>
            <Ionicons name="add-circle-outline" size={22} color="#ffc801" />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 8 }}
          >
            <StoryItem user={user} isOwn={true} />
            <StoryItem user={{ name: 'Hamza', avatar: 'https://via.placeholder.com/60', image: null }} />
            <StoryItem user={{ name: 'Nabil', avatar: 'https://via.placeholder.com/60', image: null }} />
            <StoryItem user={{ name: 'John', avatar: 'https://via.placeholder.com/60', image: null }} />
          </ScrollView>
        </View>

        {/* Divider */}
        <View style={{ height: 0.5, backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0' }} />

        {/* Create Post — padded */}
        <View className="px-4 py-3">
          <CreatePost onPostPress={() => {}} onPostCreated={handlePostCreated} />
        </View>

        {/* Divider */}
        <View style={{ height: 8, backgroundColor: isDark ? '#0f0f0f' : '#efefef' }} />

        {/* Feed — full-width, no padding */}
        {loading ? (
          <View className="py-16 items-center">
            <ActivityIndicator size="large" color="#ffc801" />
            <Text className="text-black/60 dark:text-white/60 mt-4">Loading feed...</Text>
          </View>
        ) : posts.length === 0 ? (
          <View className="py-16 items-center mx-4 bg-light/30 dark:bg-dark/30 rounded-2xl">
            <Ionicons name="document-text-outline" size={48} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'} />
            <Text className="text-black/60 dark:text-white/60 text-center mt-4 px-4">
              No posts yet. Be the first to share something!
            </Text>
          </View>
        ) : (
          posts.map((item) => (
            <FeedItem
              key={item.id}
              item={{ ...item, onRepost: handleRepost }}
            />
          ))
        )}
      </ScrollView>
    </AppLayout>
  );
}
