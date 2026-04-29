import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, TextInput, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import AudioRecorder from './AudioRecorder';
import VoiceRecorder from '../VoiceRecorder';
import Skeleton from '@/components/ui/Skeleton';

// Conditionally import expo-image-picker
let ImagePicker = null;
try {
    ImagePicker = require('expo-image-picker');
} catch (_error) {
    console.warn('expo-image-picker not installed. Camera and photo library features will be disabled.');
}

// Component dial input dial message
export default function MessageInput({
    newMessage,
    setNewMessage,
    sending,
    isRecording,
    recordingTime,
    attachment,
    setAttachment,
    audioBlob,
    audioURL,
    setAudioBlob,
    setAudioURL,
    mediaRecorderRef,
    fileInputRef,
    handleFileSelect,
    startRecording,
    stopRecording,
    cancelRecording,
    handleSendMessage,
    isExpanded,
    audioDuration,
    onTypingStart,
    onTypingStop,
    isPaused,
    onPause,
    onResume,
}) {
    // Typing indicator management
    const typingTimeoutRef = useRef(null);
    const hasTypedRef = useRef(false);
    const lastTypingTimeRef = useRef(0);

    // Handle typing events on input change - triggers typing indicator
    const handleInputChange = (value) => {
        setNewMessage(value);
        
        if (!onTypingStart || !onTypingStop) return;

        // Only trigger if user is actually typing (has content)
        if (value.trim().length > 0) {
            const now = Date.now();
            
            // Debounce typing start - only trigger every 1 second max
            if (!hasTypedRef.current || (now - lastTypingTimeRef.current) > 1000) {
                onTypingStart();
                hasTypedRef.current = true;
                lastTypingTimeRef.current = now;
            }
            
            // Clear existing timeout
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            
            // Stop typing after 2 seconds of inactivity
            typingTimeoutRef.current = setTimeout(() => {
                onTypingStop();
                hasTypedRef.current = false;
            }, 2000);
        } else {
            // Stop typing if input is cleared
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            onTypingStop();
            hasTypedRef.current = false;
        }
    };

    // Stop typing when message is sent or component unmounts
    useEffect(() => {
        if (!newMessage.trim() && hasTypedRef.current && onTypingStop) {
            onTypingStop();
            hasTypedRef.current = false;
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        }
        
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
            if (hasTypedRef.current && onTypingStop) {
                onTypingStop();
            }
        };
    }, [newMessage, onTypingStop]);

    // Format audio duration
    const formatAudioDuration = (seconds) => {
        if (!seconds) return '';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Request permissions
    useEffect(() => {
        (async () => {
            if (Platform.OS !== 'web' && ImagePicker) {
                try {
                    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
                    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
                        Alert.alert('Permission needed', 'Camera and media library permissions are required to attach files.');
                    }
                } catch (error) {
                    console.warn('Failed to request image picker permissions:', error);
                }
            }
        })();
    }, []);

    // Show attachment options menu
    const showAttachmentMenu = () => {
        const options = [];
        
        if (ImagePicker) {
            options.push(
                {
                    text: 'Camera',
                    onPress: handleCameraCapture,
                    style: 'default',
                },
                {
                    text: 'Photo Library',
                    onPress: handleImagePicker,
                    style: 'default',
                }
            );
        }
        
        options.push(
            {
                text: 'Files',
                onPress: handleFilePicker,
                style: 'default',
            },
            {
                text: 'Cancel',
                style: 'cancel',
            }
        );
        
        Alert.alert(
            'Choose Attachment',
            'Select how you want to attach a file',
            options,
            { cancelable: true }
        );
    };

    // Handle camera capture
    const handleCameraCapture = async () => {
        if (!ImagePicker) {
            Alert.alert('Not Available', 'Camera feature requires expo-image-picker. Please run: npm install');
            return;
        }
        
        try {
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsEditing: true,
                quality: 0.8,
                allowsMultipleSelection: false,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                setAttachment({
                    uri: asset.uri,
                    name: asset.uri.split('/').pop() || 'photo.jpg',
                    type: asset.type === 'image' ? 'image/jpeg' : asset.mimeType || 'image/jpeg',
                    size: asset.fileSize || 0,
                });
            }
        } catch (error) {
            console.error('Error capturing from camera:', error);
            Alert.alert('Error', 'Failed to capture image from camera');
        }
    };

    // Handle image picker (photo library)
    const handleImagePicker = async () => {
        if (!ImagePicker) {
            Alert.alert('Not Available', 'Photo library feature requires expo-image-picker. Please run: npm install');
            return;
        }
        
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.All,
                allowsEditing: true,
                quality: 0.8,
                allowsMultipleSelection: false,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                setAttachment({
                    uri: asset.uri,
                    name: asset.uri.split('/').pop() || (asset.type === 'image' ? 'photo.jpg' : 'video.mp4'),
                    type: asset.type === 'image' ? (asset.mimeType || 'image/jpeg') : (asset.mimeType || 'video/mp4'),
                    size: asset.fileSize || 0,
                });
            }
        } catch (error) {
            console.error('Error picking image:', error);
            Alert.alert('Error', 'Failed to pick image from library');
        }
    };

    // Handle file picker
    const handleFilePicker = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['image/*', 'video/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets[0]) {
                const file = result.assets[0];
                setAttachment({
                    uri: file.uri,
                    name: file.name,
                    type: file.mimeType,
                    size: file.size,
                });
            }
        } catch (error) {
            console.error('Error picking file:', error);
            Alert.alert('Error', 'Failed to pick file');
        }
    };

    return (
        <View className="px-4 py-3 border-t border-light/20 dark:border-dark/20 bg-light dark:bg-dark">
            {/* Attachment Preview */}
            {attachment && (
                <View className="mb-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex-row items-center gap-2">
                    {attachment.type?.startsWith('image/') ? (
                        <Text className="text-xs">📷 Image selected</Text>
                    ) : (
                        <Text className="text-xs">📎 {attachment.name}</Text>
                    )}
                    <Pressable
                        onPress={() => setAttachment(null)}
                        className="ml-auto"
                    >
                        <Ionicons name="close" size={16} color="#666" />
                    </Pressable>
                </View>
            )}

            {/* Audio Preview */}
            {audioURL && audioBlob && (
                <View className="mb-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex-row items-center gap-2">
                    <View className="w-2 h-2 bg-red-500 rounded-full" />
                    <Text className="text-xs flex-1">Voice message ready</Text>
                    {audioDuration && (
                        <Text className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                            {formatAudioDuration(audioDuration)}
                        </Text>
                    )}
                    <Pressable
                        onPress={() => {
                            setAudioBlob(null);
                            setAudioURL(null);
                        }}
                    >
                        <Ionicons name="close" size={16} color="#666" />
                    </Pressable>
                </View>
            )}

            {/* Recording Indicator - Instagram Style */}
            {isRecording && (
                <View className="mb-2">
                    <AudioRecorder
                        onSend={() => {
                            stopRecording();
                            setTimeout(() => {
                                if (audioBlob) {
                                    handleSendMessage();
                                }
                            }, 100);
                        }}
                        onCancel={cancelRecording}
                        isRecording={isRecording}
                        isPaused={isPaused}
                        onPause={onPause}
                        onResume={onResume}
                        recordingTime={recordingTime}
                    />
                </View>
            )}

            <View className="flex-row gap-2 items-end">
                <Pressable
                    onPress={showAttachmentMenu}
                    className="h-10 w-10 items-center justify-center"
                >
                    <Ionicons name="attach" size={20} color="#ffc801" />
                </Pressable>
                
                <View className="flex-1">
                    <TextInput
                        value={newMessage}
                        onChangeText={handleInputChange}
                        placeholder="Type a message..."
                        placeholderTextColor="#999"
                        className="min-h-10 text-sm px-3 bg-gray-100 dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700 text-black dark:text-white"
                        editable={!sending && !isRecording}
                        multiline
                        style={{ maxHeight: 100 }}
                    />
                </View>
                
                {!isRecording ? (
                    <>
                        <VoiceRecorder
                            onRecordingComplete={(uri, duration, mimeType) => {
                                setAudioBlob({ uri });
                                setAudioURL(uri);
                            }}
                            onCancel={() => {
                                setAudioBlob(null);
                                setAudioURL(null);
                            }}
                            disabled={sending}
                            onSendAudioDirect={async (uri, duration, mimeType) => {
                                // This will be handled by the parent component
                                // For now, we'll set it and let handleSendMessage use it
                                setAudioBlob({ uri });
                                setAudioURL(uri);
                            }}
                        />
                        <Pressable 
                            onPress={handleSendMessage}
                            disabled={sending || (!newMessage.trim() && !attachment && !audioBlob)}
                            className={`h-10 w-10 items-center justify-center rounded-full ${sending || (!newMessage.trim() && !attachment && !audioBlob) ? 'bg-gray-300 dark:bg-gray-700 opacity-50' : 'bg-alpha'}`}
                        >
                            {sending ? (
                                <Skeleton width={16} height={16} borderRadius={8} isDark={false} />
                            ) : (
                                <Ionicons name="send" size={18} color="#000" />
                            )}
                        </Pressable>
                    </>
                ) : null}
            </View>
        </View>
    );
}
