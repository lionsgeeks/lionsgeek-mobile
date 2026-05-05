import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppContext } from '@/context';
import API from '@/api';
import FeedItem from '@/components/feed/FeedItem';
import Skeleton from '@/components/ui/Skeleton';

export default function PostDetailsScreen() {
  const { id } = useLocalSearchParams();
  const postId = useMemo(() => {
    const raw = Array.isArray(id) ? id[0] : id;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, [id]);

  const { token } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState(null);

  useEffect(() => {
    if (!postId) {
      setLoading(false);
      setPost(null);
      return;
    }
    if (!token) {
      setLoading(false);
      setPost(null);
      return;
    }

    let mounted = true;
    const fetchPost = async () => {
      setLoading(true);
      try {
        const res = await API.getWithAuth(`mobile/posts/${postId}`, token);
        const data = res?.data?.post ?? res?.data ?? null;
        if (!mounted) return;
        setPost(data);
      } catch (_error) {
        if (!mounted) return;
        setPost(null);
        Alert.alert('Error', 'Failed to load this post. Please try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchPost();
    return () => {
      mounted = false;
    };
  }, [postId, token]);

  const bg = isDark ? '#0f0f0f' : '#ffffff';
  const text = isDark ? '#ffffff' : '#111111';

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 14,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderBottomWidth: 0.5,
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={text} />
        </Pressable>
        <Text style={{ color: text, fontWeight: '900', fontSize: 16 }}>Post</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingVertical: 10 }}>
        {loading ? (
          <View style={{ paddingHorizontal: 16, gap: 10 }}>
            <Skeleton width="100%" height={56} borderRadius={12} isDark={isDark} />
            <Skeleton width="100%" height={320} borderRadius={12} isDark={isDark} />
            <Skeleton width="100%" height={120} borderRadius={12} isDark={isDark} />
          </View>
        ) : !token ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: text, fontWeight: '800' }}>You must be logged in to view this post.</Text>
          </View>
        ) : !post ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: text, fontWeight: '800' }}>Post not found.</Text>
          </View>
        ) : (
          <FeedItem item={post} />
        )}
      </ScrollView>
    </View>
  );
}

