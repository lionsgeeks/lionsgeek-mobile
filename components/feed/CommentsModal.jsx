import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAppContext } from '@/context';
import API from '@/api';

function resolveAvatarUrl(value) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.includes('storage/')) {
    const cleanPath = value.startsWith('/') ? value : `/${value}`;
    return `${API.APP_URL}${cleanPath}`;
  }
  return `${API.APP_URL}/storage/img/profile/${value}`;
}

function formatTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (mins > 0) return `${mins}m`;
  return 'just now';
}

function CommentRow({ comment, isDark, mutedColor, textColor }) {
  const avatarUrl = resolveAvatarUrl(comment.user?.avatar);
  const initial = (comment.user?.name || 'U').charAt(0).toUpperCase();

  return (
    <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10 }}>
      {/* Avatar */}
      <View
        style={{
          width: 36, height: 36, borderRadius: 18,
          marginRight: 10,
          backgroundColor: isDark ? '#2a2a2a' : '#e5e5e5',
          overflow: 'hidden',
          alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: 36, height: 36, borderRadius: 18 }}
          />
        ) : (
          <Text style={{ fontWeight: '800', fontSize: 14, color: isDark ? '#fff' : '#000' }}>
            {initial}
          </Text>
        )}
      </View>

      {/* Bubble */}
      <View style={{ flex: 1 }}>
        <View
          style={{
            backgroundColor: isDark ? '#2a2a2a' : '#f3f2ef',
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text style={{ fontWeight: '700', fontSize: 13, color: textColor, marginBottom: 2 }}>
            {comment.user?.name || 'User'}
          </Text>
          <Text style={{ fontSize: 14, color: textColor, lineHeight: 20 }}>
            {comment.body}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: mutedColor, marginTop: 4, marginLeft: 4 }}>
          {formatTime(comment.created_at)}
        </Text>
      </View>
    </View>
  );
}

/**
 * Bottom-sheet style comments modal.
 * Opens when the user taps the comment icon on any FeedItem.
 */
export default function CommentsModal({ visible, postId, postAuthorName, onClose, onCommentAdded }) {
  const { token, user } = useAppContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  const bgColor = isDark ? '#1c1c1c' : '#ffffff';
  const handleColor = isDark ? '#444' : '#d0cdc8';
  const borderColor = isDark ? '#2e2e2e' : '#e8e5e0';
  const textColor = isDark ? '#f5f5f5' : '#111111';
  const mutedColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)';
  const inputBg = isDark ? '#2a2a2a' : '#f3f2ef';

  const myAvatarUrl = resolveAvatarUrl(user?.avatar || user?.image);
  const myInitial = (user?.name || 'U').charAt(0).toUpperCase();

  useEffect(() => {
    if (visible && postId) {
      fetchComments();
    }
  }, [visible, postId]);

  const fetchComments = async () => {
    setLoading(true);
    try {
      const response = await API.get(`mobile/posts/${postId}/comments`, token);
      if (response?.data?.comments) {
        setComments(response.data.comments);
      }
    } catch {
      // Comments unavailable — show empty state
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText('');

    // Optimistic insert
    const tempComment = {
      id: `temp-${Date.now()}`,
      body: text,
      created_at: new Date().toISOString(),
      user: {
        id: user?.id,
        name: user?.name || 'You',
        avatar: user?.avatar || user?.image || null,
      },
    };
    setComments(prev => [...prev, tempComment]);

    // Scroll to bottom after adding
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await API.post(`mobile/posts/${postId}/comments`, { comment: text }, token);
      if (response?.data?.comment) {
        // Replace temp with real comment from server
        setComments(prev =>
          prev.map(c => (c.id === tempComment.id ? response.data.comment : c))
        );
        if (onCommentAdded) onCommentAdded();
      }
    } catch {
      // Revert optimistic insert on failure
      setComments(prev => prev.filter(c => c.id !== tempComment.id));
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setComments([]);
    setInputText('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      {/* Dim overlay */}
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        onPress={handleClose}
      />

      {/* Sheet — takes up ~75% of screen height */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: '75%',
          backgroundColor: bgColor,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          overflow: 'hidden',
        }}
      >
        {/* Drag handle */}
        <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: handleColor }} />
        </View>

        {/* Header */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingVertical: 10,
            borderBottomWidth: 0.5, borderBottomColor: borderColor,
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: textColor }}>
            Comments
          </Text>
          <TouchableOpacity onPress={handleClose} style={{ padding: 4 }}>
            <Ionicons name="close" size={22} color={mutedColor} />
          </TouchableOpacity>
        </View>

        {/* Comments list */}
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="small" color="#ffc801" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={comments}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <CommentRow
                comment={item}
                isDark={isDark}
                textColor={textColor}
                mutedColor={mutedColor}
              />
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <Ionicons name="chatbubble-ellipses-outline" size={36} color={mutedColor} />
                <Text style={{ color: mutedColor, marginTop: 10, fontSize: 14 }}>
                  No comments yet. Be the first!
                </Text>
              </View>
            }
            contentContainerStyle={{ paddingTop: 4, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              comments.length > 0 && flatListRef.current?.scrollToEnd({ animated: false })
            }
          />
        )}

        {/* Input bar */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center',
            paddingHorizontal: 12, paddingVertical: 10,
            borderTopWidth: 0.5, borderTopColor: borderColor,
            gap: 10,
          }}
        >
          {/* My avatar */}
          <View
            style={{
              width: 34, height: 34, borderRadius: 17,
              backgroundColor: isDark ? '#2a2a2a' : '#e5e5e5',
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
            }}
          >
            {myAvatarUrl ? (
              <Image source={{ uri: myAvatarUrl }} style={{ width: 34, height: 34, borderRadius: 17 }} />
            ) : (
              <Text style={{ fontWeight: '800', fontSize: 13, color: isDark ? '#fff' : '#000' }}>
                {myInitial}
              </Text>
            )}
          </View>

          {/* Text input */}
          <TextInput
            ref={inputRef}
            value={inputText}
            onChangeText={setInputText}
            placeholder={`Comment as ${user?.name || 'you'}…`}
            placeholderTextColor={mutedColor}
            style={{
              flex: 1,
              backgroundColor: inputBg,
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: Platform.OS === 'ios' ? 9 : 7,
              fontSize: 14,
              color: textColor,
              maxHeight: 100,
            }}
            multiline
            returnKeyType="default"
          />

          {/* Send button */}
          <TouchableOpacity
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
            style={{
              width: 38, height: 38, borderRadius: 19,
              backgroundColor: inputText.trim() ? '#ffc801' : (isDark ? '#2a2a2a' : '#e5e5e5'),
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {sending ? (
              <ActivityIndicator size="small" color={inputText.trim() ? '#000' : mutedColor} />
            ) : (
              <Ionicons
                name="send"
                size={16}
                color={inputText.trim() ? '#000' : mutedColor}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
