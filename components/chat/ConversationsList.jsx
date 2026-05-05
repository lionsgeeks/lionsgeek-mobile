import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from 'react';
import { View, Text, Pressable, Image, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { useAppContext } from '@/context';
import API from '@/api';
import ChatBox from './ChatBox';
import ConversationDeletePopover from './partials/ConversationDeletePopover';
import Skeleton from '@/components/ui/Skeleton';
import { userHasAdminRole } from '@/components/helpers/helpers';

// Component dial list dial conversations - ybdl conversations w y7al chatbox
const ConversationsList = forwardRef(function ConversationsList({ onCloseChat, onUnreadCountChange }, ref) {
    const { user, token } = useAppContext();
    const currentUser = user;
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const searchTimeoutRef = useRef(null);

    // Expose method dial open conversation dyal user specific
    useImperativeHandle(ref, () => ({
        openConversationWithUser: async (userId) => {
            try {
                const response = await API.getWithAuth(`mobile/chat/conversation/${userId}`, token);
                if (response && response.data) {
                    setSelectedConversation(response.data.conversation);
                }
            } catch (error) {
                console.error('Failed to open conversation:', error);
            }
        }
    }));

    useEffect(() => {
        fetchConversations();
    }, []);

    // Fetch conversations b fetch
    const fetchConversations = React.useCallback(async () => {
        try {
            setLoading(true);
            const response = await API.getWithAuth('mobile/chat', token);

            if (response && response.data) {
                const fetchedConversations = response.data.conversations || [];
                setConversations(fetchedConversations);

                const totalUnread = fetchedConversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
                if (onUnreadCountChange) {
                    onUnreadCountChange(totalUnread);
                }
            }
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
            setConversations([]);
        } finally {
            setLoading(false);
        }
    }, [token, onUnreadCountChange]);

    // Handle conversation click b fetch
    const handleConversationClick = async (conversationId, otherUserId) => {
        try {
            const response = await API.getWithAuth(`mobile/chat/conversation/${otherUserId}`, token);
            if (response && response.data) {
                setSelectedConversation(response.data.conversation);
                fetchConversations();
            }
        } catch (error) {
            console.error('Failed to fetch conversation:', error);
        }
    };

    // Search for users when typing
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearchingUsers(false);
            return;
        }

        setIsSearchingUsers(true);
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const response = await API.getWithAuth(`mobile/search?q=${encodeURIComponent(searchQuery)}&type=students`, token);

                if (response && response.data) {
                    const users = response.data.results || [];
                    
                    // Get following IDs to filter users
                    const followingResponse = await API.getWithAuth('mobile/chat/following-ids', token);
                    
                    let followingIds = [];
                    if (followingResponse && followingResponse.data) {
                        followingIds = followingResponse.data.following_ids || [];
                    }
                    
                    // Filter users: exclude current user and only show users we follow
                    const filteredUsers = users.filter(user => 
                        user.id !== currentUser.id && 
                        followingIds.includes(user.id)
                    );
                    
                    setSearchResults(filteredUsers);
                }
            } catch (error) {
                console.error('Failed to search users:', error);
                setSearchResults([]);
            } finally {
                setIsSearchingUsers(false);
            }
        }, 300);
    }, [searchQuery, currentUser?.id, token]);

    const viewerIsAdmin = userHasAdminRole(currentUser);
    const q = searchQuery.toLowerCase();
    const filteredConversations = conversations.filter((conv) => {
        const nameMatch = conv.other_user?.name?.toLowerCase().includes(q);
        const emailMatch =
            viewerIsAdmin && conv.other_user?.email?.toLowerCase().includes(q);
        return nameMatch || emailMatch;
    });

    // Handle user selection from search
    const handleUserSelect = async (userId) => {
        try {
            setSearchQuery('');
            setSearchResults([]);
            
            const response = await API.getWithAuth(`mobile/chat/conversation/${userId}`, token);
            if (response && response.data) {
                setSelectedConversation(response.data.conversation);
                fetchConversations();
            }
        } catch (error) {
            console.error('Failed to start conversation:', error);
            alert('Failed to start conversation. Please try again.');
        }
    };

    // Skeleton loader
    const ConversationListSkeleton = () => (
        <View className="p-2 gap-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <View key={i} className="w-full flex-row items-center gap-3 p-3 rounded-xl bg-gray-200/20 dark:bg-gray-800/20">
                    <View className="h-12 w-12 rounded-full bg-gray-300 dark:bg-gray-700" />
                    <View className="flex-1 gap-2">
                        <View className="flex-row items-center justify-between">
                            <View className="h-4 w-2/3 bg-gray-300 dark:bg-gray-700 rounded" />
                            <View className="h-3 w-12 bg-gray-300 dark:bg-gray-700 rounded" />
                        </View>
                        <View className="h-3 w-full max-w-[80%] bg-gray-300 dark:bg-gray-700 rounded" />
                    </View>
                </View>
            ))}
        </View>
    );

    return (
        <View className="flex-row flex-1 w-full bg-light dark:bg-dark">
            {/* Left Sidebar - Conversations */}
            <View className={`flex-col bg-light dark:bg-dark ${selectedConversation 
                    ? 'hidden' 
                    : 'flex-1'
                }`}>
                {/* Header - Removed since we have header in chat.jsx */}

                {/* Search */}
                <View className="px-4 py-3 border-b border-light/20 dark:border-dark/20 bg-light dark:bg-dark">
                    <View className="relative">
                        <Ionicons name="search" size={18} color="#999" style={{ position: 'absolute', left: 12, top: 10, zIndex: 1 }} />
                        <TextInput
                            placeholder="Search conversations or users..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            className="pl-10 h-10 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-black dark:text-white px-4"
                            placeholderTextColor="#999"
                        />
                    </View>
                    
                    {/* User Search Results */}
                    {searchQuery.trim() && searchResults.length > 0 && (
                        <ScrollView className="mt-2 max-h-64">
                            <Text className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1">
                                Start conversation with:
                            </Text>
                            {searchResults.map((user) => (
                                <Pressable
                                    key={user.id}
                                    onPress={() => handleUserSelect(user.id)}
                                    className="w-full flex-row items-center gap-3 p-3 rounded-lg"
                                >
                                    {user.image || user.avatar ? (
                                        <Image
                                            source={{ uri: `${API.APP_URL}/storage/img/profile/${user.image || user.avatar}` }}
                                            className="h-10 w-10 rounded-full"
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View className="h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-700 items-center justify-center">
                                            <Ionicons name="person" size={20} color="#666" />
                                        </View>
                                    )}
                                    <View className="flex-1">
                                        <Text className="text-sm font-medium text-black dark:text-white" numberOfLines={1}>
                                            {user.name}
                                        </Text>
                                        {viewerIsAdmin && user.email ? (
                                            <Text className="text-xs text-gray-500 dark:text-gray-400" numberOfLines={1}>
                                                {user.email}
                                            </Text>
                                        ) : null}
                                    </View>
                                </Pressable>
                            ))}
                        </ScrollView>
                    )}
                    
                    {searchQuery.trim() && isSearchingUsers && (
                        <View className="mt-2 px-2 py-3 items-center">
                            <Skeleton width={18} height={18} borderRadius={9} isDark={false} />
                        </View>
                    )}
                    
                    {searchQuery.trim() && !isSearchingUsers && searchResults.length === 0 && filteredConversations.length === 0 && (
                        <View className="mt-2 px-2 py-3">
                            <Text className="text-sm text-gray-500 dark:text-gray-400 text-center">
                                No users found. Make sure you are following them first.
                            </Text>
                        </View>
                    )}
                </View>

                {/* Conversations List */}
                <ScrollView className="flex-1">
                    {loading ? (
                        <ConversationListSkeleton />
                    ) : filteredConversations.length === 0 ? (
                        <View className="flex-col items-center justify-center h-full py-12">
                            <Ionicons name="chatbubbles-outline" size={64} color="#999" />
                            <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-4">
                                {searchQuery ? 'No conversations found' : 'No messages yet'}
                            </Text>
                            <Text className="text-xs mt-1 text-gray-400 dark:text-gray-500">
                                {searchQuery ? 'Try a different search' : 'Start a conversation'}
                            </Text>
                        </View>
                    ) : (
                        <View className="px-2 py-1 gap-1">
                            {filteredConversations.map((conversation) => (
                                <ConversationItem
                                    key={conversation.id}
                                    conversation={conversation}
                                    currentUserId={currentUser?.id}
                                    otherUserName={conversation.other_user?.name}
                                    isSelected={selectedConversation?.id === conversation.id}
                                    onClick={() => handleConversationClick(conversation.id, conversation.other_user.id)}
                                    onDeleted={() => {
                                        setConversations(prev => prev.filter(c => c.id !== conversation.id));
                                        if (selectedConversation?.id === conversation.id) {
                                            setSelectedConversation(null);
                                        }
                                        fetchConversations();
                                    }}
                                />
                            ))}
                        </View>
                    )}
                </ScrollView>
            </View>

            {/* Right Side - Chat Box - Full screen on mobile */}
            {selectedConversation && (
                <View className="flex-1 absolute inset-0 bg-light dark:bg-dark z-10">
                    <ChatBox
                        conversation={selectedConversation}
                        onBack={() => {
                            setSelectedConversation(null);
                            fetchConversations();
                        }}
                        onClose={onCloseChat}
                        isExpanded={false}
                    />
                </View>
            )}
        </View>
    );
});

export default ConversationsList;

function ConversationItem({ conversation, currentUserId, otherUserName, isSelected, onClick, onDeleted }) {
    // Format last message preview
    const getLastMessagePreview = () => {
        if (!conversation.last_message) return 'No messages yet';
        
        const { body, attachment_type, sender_id } = conversation.last_message;
        const isFromCurrentUser = sender_id === currentUserId;
        const prefix = isFromCurrentUser ? 'You: ' : `${otherUserName}: `;

        const isPostShare = (() => {
            if (!body) return false;
            if (typeof body === 'object') return body?.type === 'post_share' && !!body?.post_id;
            if (typeof body !== 'string') return false;
            const trimmed = body.trim();
            if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;
            try {
                const parsed = JSON.parse(trimmed);
                return parsed?.type === 'post_share' && !!parsed?.post_id;
            } catch {
                return false;
            }
        })();
        
        if (attachment_type === 'image') return prefix + '📷 Image';
        if (attachment_type === 'video') return prefix + '🎥 Video';
        if (attachment_type === 'audio') return prefix + '🎤 Voice message';
        if (attachment_type === 'file') return prefix + '📎 File';
        if (isPostShare) return prefix + '📌 Post';
        if (body) {
            if (typeof body !== 'string') return prefix + 'Message';
            const preview = body.length > 80 ? body.substring(0, 80) + '...' : body;
            return prefix + preview;
        }
        
        return prefix + '📎 Attachment';
    };

    return (
        <View className="relative">
            <Pressable
                onPress={onClick}
                className={`w-full flex-row items-center gap-3 p-3 rounded-xl ${isSelected 
                    ? 'bg-alpha/20' 
                    : 'bg-transparent'
                } ${conversation.unread_count > 0 && !isSelected && 'bg-alpha/10'}`}
            >
                <View className="relative shrink-0">
                    {conversation.other_user?.image ? (
                        <Image
                            source={{ uri: `${API.APP_URL}/storage/img/profile/${conversation.other_user.image}` }}
                            className={`h-12 w-12 rounded-full ${isSelected 
                                ? 'border-2 border-alpha' 
                                : conversation.unread_count > 0
                                    ? 'border-2 border-alpha/50'
                                    : ''
                            }`}
                            resizeMode="cover"
                        />
                    ) : (
                        <View className={`h-12 w-12 rounded-full bg-gray-300 dark:bg-gray-700 items-center justify-center ${isSelected 
                            ? 'border-2 border-alpha' 
                            : conversation.unread_count > 0
                                ? 'border-2 border-alpha/50'
                                : ''
                        }`}>
                            <Ionicons name="person" size={20} color="#666" />
                        </View>
                    )}
                    {conversation.unread_count > 0 && (
                        <View className="absolute -bottom-1 -right-1 h-5 w-5 items-center justify-center rounded-full bg-yellow-500 border-2 border-white dark:border-gray-900">
                            <Text className="text-[10px] font-bold text-black">
                                {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                            </Text>
                        </View>
                    )}
                </View>
                <View className="flex-1 min-w-0">
                    <View className="flex-row items-center justify-between mb-1.5 gap-2">
                        <Text className={`text-sm font-semibold ${conversation.unread_count > 0 
                            ? 'font-bold text-black dark:text-white' 
                            : 'text-black dark:text-white/90'
                        }`} numberOfLines={1}>
                            {conversation.other_user?.name || 'User'}
                        </Text>
                        {conversation.last_message_at && (
                            <Text className={`text-xs font-medium ${conversation.unread_count > 0 
                                ? 'text-yellow-500' 
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                                {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })
                                    .replace('about ', '')
                                    .replace(' ago', '')
                                    .replace(' minutes', 'm')
                                    .replace(' hours', 'h')
                                    .replace(' days', 'd')
                                    .replace(' weeks', 'w')
                                    .replace(' months', 'mo')}
                            </Text>
                        )}
                    </View>
                    {conversation.last_message && (
                        <Text className={`text-xs ${conversation.unread_count > 0 
                            ? 'font-medium text-black dark:text-white/90' 
                            : 'text-gray-500 dark:text-gray-400'
                        }`} numberOfLines={1}>
                            {getLastMessagePreview()}
                        </Text>
                    )}
                    {!conversation.last_message && (
                        <Text className="text-xs text-gray-500 dark:text-gray-400 italic">Start a conversation</Text>
                    )}
                </View>
            </Pressable>
            <View className="absolute top-3 right-3 opacity-0">
                <ConversationDeletePopover 
                    conversationId={conversation.id}
                    onDeleted={onDeleted}
                />
            </View>
        </View>
    );
}
