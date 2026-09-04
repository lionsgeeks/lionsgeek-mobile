import React from 'react';
import { View, Text, Pressable, Image, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppContext } from '@/context';
import { isGatedChatAttachmentUrl, resolveAttachmentUrl } from './resolveAttachmentUrl';

// Panel dial preview f right side dial chatbox
export default function PreviewPanel({ attachment, onClose, onPrevious, onNext, hasMultiple, currentIndex, totalCount }) {
    const { token } = useAppContext();
    if (!attachment) return null;

    const isImage = attachment.type === 'image' || attachment.path?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
    const isVideo = attachment.type === 'video' || attachment.path?.match(/\.(mp4|webm|mov|avi)$/i);
    const mediaUrl = resolveAttachmentUrl(attachment.path);
    const authHeaders = isGatedChatAttachmentUrl(mediaUrl) && token
        ? { Authorization: `Bearer ${token}` }
        : undefined;

    const handleDownload = async () => {
        try {
            if (isGatedChatAttachmentUrl(mediaUrl) && token) {
                const FileSystem = await import('expo-file-system/legacy');
                const safeName = (attachment.name || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
                const dest = `${FileSystem.cacheDirectory}${Date.now()}_${safeName}`;
                const result = await FileSystem.downloadAsync(mediaUrl, dest, {
                    headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
                });
                await Linking.openURL(result.uri);
                return;
            }
            await Linking.openURL(mediaUrl);
        } catch (error) {
            console.error('Error opening URL:', error);
        }
    };

    return (
        <View className="w-full h-full bg-gray-900 dark:bg-black flex-col">
            {/* Controls Header */}
            <View className="flex-row items-center justify-between p-4 border-b border-gray-800 bg-gray-900">
                <Text className="text-sm font-semibold text-white">Preview</Text>
                <View className="flex-row items-center gap-2">
                    {hasMultiple && (
                        <>
                            <Pressable
                                onPress={onPrevious}
                                className="h-8 w-8 items-center justify-center"
                            >
                                <Ionicons name="chevron-back" size={16} color="#fff" />
                            </Pressable>
                            <Text className="text-xs text-gray-400">
                                {currentIndex + 1} / {totalCount}
                            </Text>
                            <Pressable
                                onPress={onNext}
                                className="h-8 w-8 items-center justify-center"
                            >
                                <Ionicons name="chevron-forward" size={16} color="#fff" />
                            </Pressable>
                        </>
                    )}
                </View>
                <View className="flex-row items-center gap-2">
                    <Pressable onPress={handleDownload} className="h-8 w-8 items-center justify-center">
                        <Ionicons name="download-outline" size={18} color="#fff" />
                    </Pressable>
                    <Pressable onPress={onClose} className="h-8 w-8 items-center justify-center">
                        <Ionicons name="close" size={18} color="#fff" />
                    </Pressable>
                </View>
            </View>

            <ScrollView contentContainerClassName="flex-1 items-center justify-center p-4" className="flex-1 bg-black/90">
                {isImage && attachment.path ? (
                    <Image
                        source={{ uri: mediaUrl, headers: authHeaders }}
                        className="w-full h-[70vh]"
                        resizeMode="contain"
                    />
                ) : null}
                {isVideo && attachment.path ? (
                    <Text className="text-white text-sm">Open video via download</Text>
                ) : null}
                {!isImage && !isVideo && attachment.path ? (
                    <View className="items-center gap-3 p-8">
                        <Ionicons name="document" size={64} color="#ffc801" />
                        <Text className="text-white text-center">{attachment.name || 'Attachment'}</Text>
                    </View>
                ) : null}
            </ScrollView>
        </View>
    );
}
