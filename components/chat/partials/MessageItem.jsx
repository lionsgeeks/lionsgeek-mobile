import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format, isToday, isYesterday } from 'date-fns';
import API from '@/api';
import VoiceMessage from '../VoiceMessage';

// Component dial message wahda
export default function MessageItem({
    message,
    isCurrentUser,
    currentUser,
    otherUser,
    showDateSeparator,
    isPlayingAudio,
    audioProgress,
    audioDuration,
    showMenuForMessage,
    onPlayAudio,
    onDeleteMessage,
    onMenuToggle,
    onPreviewAttachment,
    onDownloadAttachment,
    formatMessageTime,
    formatSeenTime,
}) {
    const router = useRouter();

    // Format file size
    const formatFileSize = (bytes) => {
        if (!bytes) return '';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    };

    const imageUrl = message.attachment_path?.startsWith('/storage/') || message.attachment_path?.startsWith('http')
        ? message.attachment_path
        : `${API.APP_URL}/storage/${message.attachment_path}`;

    const bubbleRadius = isCurrentUser
        ? {
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              borderBottomLeftRadius: 18,
              borderBottomRightRadius: 4,
          }
        : {
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              borderBottomLeftRadius: 4,
              borderBottomRightRadius: 18,
          };

    return (
        <>
            {showDateSeparator && (
                <View className="flex-row items-center my-5 px-2">
                    <View className="flex-1 h-px bg-black/10 dark:bg-white/10" />
                    <Text className="mx-3 text-[10px] font-bold tracking-[0.2em] text-black/40 dark:text-white/40 uppercase">
                        {isToday(new Date(message.created_at))
                            ? 'Today'
                            : isYesterday(new Date(message.created_at))
                              ? 'Yesterday'
                              : format(new Date(message.created_at), 'MMM d, yyyy')}
                    </Text>
                    <View className="flex-1 h-px bg-black/10 dark:bg-white/10" />
                </View>
            )}
            <View className={`flex-row mb-3 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                {!isCurrentUser && (
                    <Pressable
                        onPress={() => router.push(`/students/${otherUser.id}`)}
                        className="mr-2 self-end mb-1"
                    >
                        {otherUser?.image ? (
                            <Image
                                source={{ uri: `${API.APP_URL}/storage/img/profile/${otherUser.image}` }}
                                className="w-8 h-8 rounded-xl"
                                resizeMode="cover"
                            />
                        ) : (
                            <View className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-800 items-center justify-center border border-black/5 dark:border-white/10">
                                <Ionicons name="person" size={16} color="#888" />
                            </View>
                        )}
                    </Pressable>
                )}
                <View
                    style={bubbleRadius}
                    className={`max-w-[85%] px-4 py-3 border ${
                        isCurrentUser
                            ? 'bg-alpha border-black/10 shadow-sm shadow-black/10'
                            : 'bg-white dark:bg-zinc-900 border-black/[0.07] dark:border-white/[0.08] shadow-sm shadow-black/5'
                    }`}
                >
                    {message.body && (
                        <Text className={`text-sm leading-relaxed ${isCurrentUser ? 'text-black' : 'text-black dark:text-white'}`}>
                            {message.body}
                        </Text>
                    )}

                    {message.attachment_type === 'image' && message.attachment_path && (
                        <Pressable
                            onPress={() => onPreviewAttachment({ type: 'image', path: message.attachment_path, name: message.attachment_name })}
                            className="mt-1 rounded-lg overflow-hidden"
                        >
                            <Image
                                source={{ uri: imageUrl }}
                                className="max-w-full max-h-64 rounded-lg"
                                resizeMode="cover"
                            />
                            {message.attachment_size && (
                                <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {formatFileSize(message.attachment_size)}
                                </Text>
                            )}
                        </Pressable>
                    )}

                    {message.attachment_type === 'video' && message.attachment_path && (
                        <Pressable
                            onPress={() => onPreviewAttachment({ type: 'video', path: message.attachment_path, name: message.attachment_name })}
                            className="mt-1 rounded-lg overflow-hidden"
                        >
                            <View className="max-w-full max-h-64 bg-gray-900 items-center justify-center rounded-lg">
                                <Ionicons name="videocam" size={48} color="#fff" />
                            </View>
                            {message.attachment_size && (
                                <Text className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {formatFileSize(message.attachment_size)}
                                </Text>
                            )}
                        </Pressable>
                    )}

                    {message.attachment_type === 'file' && message.attachment_path && (
                        <Pressable
                            onPress={() => onDownloadAttachment(message.attachment_path, message.attachment_name)}
                            className={`mt-2 w-full flex-row items-center gap-3 p-3 rounded-lg border ${isCurrentUser ? 'bg-white/10 border-white/20' : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`}
                        >
                            <Ionicons name="document" size={20} color={isCurrentUser ? '#ffc801' : '#666'} />
                            <View className="flex-1">
                                <Text className={`text-xs ${isCurrentUser ? 'text-black' : 'text-black dark:text-white'}`} numberOfLines={1}>
                                    {message.attachment_name || 'Attachment'}
                                </Text>
                                {message.attachment_size && (
                                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatFileSize(message.attachment_size)}
                                    </Text>
                                )}
                            </View>
                            <Ionicons name="download" size={16} color={isCurrentUser ? '#ffc801' : '#666'} />
                        </Pressable>
                    )}

                    {message.attachment_type === 'audio' && message.attachment_path && (
                        <View className={`mt-2 flex-row items-center gap-3 p-3 rounded-lg ${isCurrentUser ? 'bg-white/10' : 'bg-gray-100 dark:bg-gray-700'}`}>
                            <VoiceMessage
                                audioUrl={imageUrl}
                                duration={audioDuration[message.id] || message.audio_duration}
                                isCurrentUser={isCurrentUser}
                            />
                        </View>
                    )}

                    <View className={`flex-row items-center gap-1.5 justify-end mt-1.5`}>
                        <Text className={`text-xs ${isCurrentUser ? 'text-black/70' : 'text-gray-500 dark:text-gray-400'}`}>
                            {formatMessageTime(message.created_at)}
                        </Text>
                        {isCurrentUser && (
                            <View className="ml-1">
                                {message.pending ? (
                                    <Ionicons name="time-outline" size={12} color="#666" />
                                ) : message.is_read && message.read_at ? (
                                    <Ionicons name="checkmark-done" size={14} color="#3b82f6" />
                                ) : (
                                    <Ionicons name="checkmark" size={14} color="#666" />
                                )}
                            </View>
                        )}
                    </View>

                    {isCurrentUser && showMenuForMessage === message.id && (
                        <View className="absolute top-2 right-2 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1 bg-white dark:bg-gray-800 z-10">
                            <Pressable
                                onPress={() => {
                                    onDeleteMessage(message.id);
                                    onMenuToggle(null);
                                }}
                                className="w-full flex-row items-center px-3 py-2"
                            >
                                <Ionicons name="trash" size={12} color="#ef4444" />
                                <Text className="ml-2 text-xs text-red-500">Delete</Text>
                            </Pressable>
                        </View>
                    )}

                    {isCurrentUser && (
                        <Pressable
                            onPress={() => onMenuToggle(showMenuForMessage === message.id ? null : message.id)}
                            className="absolute top-2 right-2 p-1"
                        >
                            <Ionicons name="ellipsis-vertical" size={14} color="#666" />
                        </Pressable>
                    )}
                </View>
                {isCurrentUser && (
                    <Pressable
                        onPress={() => router.push(`/students/${currentUser.id}`)}
                        className="ml-2 self-end mb-1"
                    >
                        {currentUser?.image ? (
                            <Image
                                source={{ uri: `${API.APP_URL}/storage/img/profile/${currentUser.image}` }}
                                className="w-8 h-8 rounded-xl"
                                resizeMode="cover"
                            />
                        ) : (
                            <View className="w-8 h-8 rounded-xl bg-alpha/30 items-center justify-center border border-black/10">
                                <Ionicons name="person" size={16} color="#444" />
                            </View>
                        )}
                    </Pressable>
                )}
            </View>
        </>
    );
}
