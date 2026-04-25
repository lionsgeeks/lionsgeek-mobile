import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import RecordingIndicator from './RecordingIndicator';

// Component dial list dial messages
export default function MessageList({
    messages,
    loading,
    currentUser,
    conversation,
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
    messagesEndRef,
    showToolbox,
    previewAttachment,
    typingUsers = [],
    recordingUsers = [],
}) {
    const isCurrentUserMessage = (senderId) => {
        return String(senderId) === String(currentUser.id);
    };

    // Skeleton loader dial messages
    const MessageSkeleton = () => (
        <View className="gap-4 max-w-3xl mx-auto">
            {[1, 2, 3, 4, 5].map((i) => (
                <View key={i} className={`flex-row mb-4 ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                    {i % 2 !== 0 && (
                        <View className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-700 mr-2" />
                    )}
                    <View className="max-w-[75%] gap-2">
                        <View className={`h-12 rounded-2xl ${i % 2 === 0 ? 'bg-yellow-500/20' : 'bg-gray-200 dark:bg-gray-800'}`} />
                        <View className="h-4 w-20 bg-gray-300 dark:bg-gray-700 rounded ml-auto" />
                    </View>
                    {i % 2 === 0 && (
                        <View className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-700 ml-2" />
                    )}
                </View>
            ))}
        </View>
    );

    return (
        <ScrollView 
            className={`flex-1 p-4 ${showToolbox && !previewAttachment ? 'w-2/3' : 'w-full'}`}
            contentContainerStyle={{ flexGrow: 1 }}
        >
            {loading && messages.length === 0 ? (
                <MessageSkeleton />
            ) : messages.length === 0 ? (
                <View className="flex-col items-center justify-center h-full">
                    <Ionicons name="chatbubbles-outline" size={64} color="#999" />
                    <Text className="text-base font-medium text-gray-500 dark:text-gray-400 mt-4">No messages yet</Text>
                    <Text className="text-sm text-gray-400 dark:text-gray-500 mt-1">Start the conversation!</Text>
                </View>
            ) : (
                <View className="gap-3 px-2">
                    {messages.map((message, index) => {
                        const isCurrentUser = isCurrentUserMessage(message.sender_id);
                        const showDateSeparator = index === 0 || 
                            new Date(message.created_at).toDateString() !== new Date(messages[index - 1].created_at).toDateString();
                        
                        return (
                            <MessageItem
                                key={message.id}
                                message={message}
                                isCurrentUser={isCurrentUser}
                                currentUser={currentUser}
                                otherUser={conversation.other_user}
                                showDateSeparator={showDateSeparator}
                                isPlayingAudio={isPlayingAudio}
                                audioProgress={audioProgress}
                                audioDuration={audioDuration}
                                showMenuForMessage={showMenuForMessage}
                                onPlayAudio={onPlayAudio}
                                onDeleteMessage={onDeleteMessage}
                                onMenuToggle={onMenuToggle}
                                onPreviewAttachment={onPreviewAttachment}
                                onDownloadAttachment={onDownloadAttachment}
                                formatMessageTime={formatMessageTime}
                                formatSeenTime={formatSeenTime}
                            />
                        );
                    })}
                    {/* Typing indicators */}
                    {typingUsers.length > 0 && typingUsers.map(userId => {
                        const user = userId === conversation.other_user.id ? conversation.other_user : null;
                        return user ? (
                            <TypingIndicator key={userId} userName={user.name} isCurrentUser={false} />
                        ) : null;
                    })}
                    {/* Recording indicators */}
                    {recordingUsers.length > 0 && recordingUsers.map(userId => {
                        const user = userId === conversation.other_user.id ? conversation.other_user : null;
                        return user ? (
                            <RecordingIndicator key={userId} userName={user.name} isCurrentUser={false} />
                        ) : null;
                    })}
                </View>
            )}
        </ScrollView>
    );
}
