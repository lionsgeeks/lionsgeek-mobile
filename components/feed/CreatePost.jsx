import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, Modal, Pressable, ActivityIndicator, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useAppContext } from '@/context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import API from '@/api';

export default function CreatePost({ onPostPress, onPostCreated }) {
  const { user, token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [showModal, setShowModal] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState('post'); // post, video, photo, article
  const keyboardVerticalOffset = useMemo(() => (Platform.OS === 'ios' ? 0 : 24), []);

  const handleCreatePost = () => {
    setShowModal(true);
  };

    const handlePost = async () => {
        if (!postContent.trim()) {
            Alert.alert('Error', 'Please enter some content for your post');
            return;
        }

        if (!token) {
            Alert.alert('Error', 'Authentication required');
            return;
        }

        setLoading(true);
        try {
            const response = await API.post('mobile/posts', {
                content: postContent,
                type: selectedType,
            }, token);

            if (response?.data) {
                Alert.alert('Success', 'Post created successfully!');
                setPostContent('');
                setShowModal(false);
                if (onPostCreated) {
                    onPostCreated(response.data.post);
                }
            }
        } catch (error) {
            console.error('[CREATE_POST] Error:', error);
            Alert.alert('Error', error?.response?.data?.message || 'Failed to create post. Please try again.');
        } finally {
            setLoading(false);
        }
    };

  // Helper function to get avatar URL - always use /storage/img/profile/
  const getImageUrl = () => {
    if (!user) return null;
    
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
    <>
      {/* Composer row */}
      <View className="flex-row items-center" style={{ gap: 10 }}>
        {(() => {
          const profileImageUrl = getImageUrl();
          return profileImageUrl ? (
            <Image
              source={{ uri: profileImageUrl }}
              className="w-9 h-9 rounded-full"
              style={{ borderWidth: 1.5, borderColor: '#ffc801' }}
              defaultSource={require('@/assets/images/icon.png')}
            />
          ) : (
            <View
              className="w-9 h-9 rounded-full bg-beta/10 dark:bg-beta/40 items-center justify-center"
              style={{ borderWidth: 1.5, borderColor: '#ffc801' }}
            >
              <Text className="text-xs font-extrabold text-black/60 dark:text-white/60">
                {(user?.name || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          );
        })()}

        <TouchableOpacity
          onPress={handleCreatePost}
          className="flex-1 py-2 px-4 rounded-full active:opacity-70"
          style={{
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.18)',
          }}
        >
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)', fontWeight: '500' }}>
            What are you thinking about?
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick-action row */}
      <View
        className="flex-row items-center mt-3 pt-3"
        style={{ borderTopWidth: 0.5, borderTopColor: isDark ? '#2a2a2a' : '#e0e0e0', gap: 4 }}
      >
        <TouchableOpacity
          onPress={() => { setSelectedType('photo'); handleCreatePost(); }}
          className="flex-1 flex-row items-center justify-center py-2 rounded-xl active:opacity-70"
        >
          <Ionicons name="image-outline" size={20} color="#43b581" />
          <Text className="text-xs font-semibold ml-1.5 text-black/70 dark:text-white/70">Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { setSelectedType('video'); handleCreatePost(); }}
          className="flex-1 flex-row items-center justify-center py-2 rounded-xl active:opacity-70"
        >
          <Ionicons name="videocam-outline" size={20} color="#5865f2" />
          <Text className="text-xs font-semibold ml-1.5 text-black/70 dark:text-white/70">Video</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { setSelectedType('article'); handleCreatePost(); }}
          className="flex-1 flex-row items-center justify-center py-2 rounded-xl active:opacity-70"
        >
          <Ionicons name="document-text-outline" size={20} color="#ffc801" />
          <Text className="text-xs font-semibold ml-1.5 text-black/70 dark:text-white/70">Article</Text>
        </TouchableOpacity>
      </View>

      {/* Create Post Modal - Full Screen */}
      <Modal
        visible={showModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          setShowModal(false);
          setPostContent('');
          setSelectedType('post');
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={keyboardVerticalOffset}
          className="flex-1 bg-light dark:bg-dark"
        >
          {/* Header */}
          <View className="pt-12 pb-4 px-6 border-b border-light/20 dark:border-dark/20">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-2xl font-bold text-black dark:text-white">Create Post</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowModal(false);
                  setPostContent('');
                  setSelectedType('post');
                }}
                className="p-2"
              >
                <Ionicons name="close" size={28} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Content */}
          <View className="flex-1 px-6 pt-6">
            <View className="flex-row items-center mb-6 pb-4 border-b border-light/20 dark:border-dark/20">
              {(() => {
                const profileImageUrl = getImageUrl();

                return profileImageUrl ? (
                  <Image
                    source={{ uri: profileImageUrl }}
                    className="w-12 h-12 rounded-full mr-3 border-2 border-alpha/30"
                    defaultSource={require('@/assets/images/icon.png')}
                  />
                ) : (
                  <View className="w-12 h-12 rounded-full mr-3 bg-beta/20 dark:bg-beta/40 items-center justify-center">
                    <Text className="text-sm font-bold text-black/60 dark:text-white/60">
                      {(user?.name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                );
              })()}
              <View className="flex-1">
                <Text className="text-base font-semibold text-black dark:text-white">
                  {user?.name || 'User'}
                </Text>
                <View className="flex-row items-center mt-1">
                  <Ionicons 
                    name={selectedType === 'video' ? 'videocam' : selectedType === 'photo' ? 'image' : selectedType === 'article' ? 'document-text' : 'document'} 
                    size={14} 
                    color={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'} 
                  />
                  <Text className="text-xs text-black/60 dark:text-white/60 ml-1 capitalize">
                    {selectedType}
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <TextInput
                className="bg-light/50 dark:bg-dark/50 rounded-xl px-4 py-4 text-black dark:text-white text-base"
                style={{ minHeight: 260 }}
                placeholder="What's on your mind?"
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'}
                value={postContent}
                onChangeText={setPostContent}
                multiline
                textAlignVertical="top"
              />

              <View className="flex-row gap-3 mt-6 mb-4">
                <Pressable
                  onPress={() => setSelectedType('post')}
                  className={`flex-1 py-3 rounded-xl items-center ${
                    selectedType === 'post' ? 'bg-alpha' : 'bg-light/50 dark:bg-dark/50 border border-light/30 dark:border-dark/30'
                  } active:opacity-80`}
                >
                  <Text className={`font-medium ${selectedType === 'post' ? 'text-black' : 'text-black/60 dark:text-white/60'}`}>
                    Text Post
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSelectedType('photo')}
                  className={`flex-1 py-3 rounded-xl items-center ${
                    selectedType === 'photo' ? 'bg-alpha' : 'bg-light/50 dark:bg-dark/50 border border-light/30 dark:border-dark/30'
                  } active:opacity-80`}
                >
                  <Text className={`font-medium ${selectedType === 'photo' ? 'text-black' : 'text-black/60 dark:text-white/60'}`}>
                    Photo
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSelectedType('video')}
                  className={`flex-1 py-3 rounded-xl items-center ${
                    selectedType === 'video' ? 'bg-alpha' : 'bg-light/50 dark:bg-dark/50 border border-light/30 dark:border-dark/30'
                  } active:opacity-80`}
                >
                  <Text className={`font-medium ${selectedType === 'video' ? 'text-black' : 'text-black/60 dark:text-white/60'}`}>
                    Video
                  </Text>
                </Pressable>
              </View>
            </ScrollView>

            {/* Footer Button */}
            <View className="pb-6 pt-4 border-t border-light/20 dark:border-dark/20">
              <Pressable
                onPress={handlePost}
                disabled={loading || !postContent.trim()}
                className={`bg-alpha dark:bg-alpha rounded-xl py-4 items-center ${
                  loading || !postContent.trim() ? 'opacity-50' : 'active:opacity-80'
                }`}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text className="text-base font-semibold text-black">Post</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
