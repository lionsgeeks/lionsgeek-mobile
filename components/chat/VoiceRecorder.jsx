import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import Skeleton from '@/components/ui/Skeleton';

export default function VoiceRecorder({ onRecordingComplete, onCancel, disabled, onStopRecordingRef, onSendAudioDirect }) {
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [canSend, setCanSend] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const shouldSendDirectlyRef = useRef(false);
    
    const recordingRef = useRef(null);
    const timerRef = useRef(null);
    const touchStartTimeRef = useRef(null);
    const waveBars = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

    // Format time as MM:SS
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Start recording
    const startRecording = async () => {
        try {
            setError(null);
            
            // Request permissions
            const { status } = await Audio.requestPermissionsAsync();
            if (status !== 'granted') {
                throw new Error('Microphone permission denied');
            }

            // Set audio mode
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            // Start recording
            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            
            recordingRef.current = recording;
            setIsRecording(true);
            setRecordingTime(0);
            setCanSend(false);
            shouldSendDirectlyRef.current = false;

            // Start timer
            timerRef.current = setInterval(() => {
                setRecordingTime((prev) => {
                    const newTime = prev + 1;
                    if (newTime >= 1) {
                        setCanSend(true);
                    }
                    return newTime;
                });
            }, 1000);
        } catch (err) {
            console.error('Error starting recording:', err);
            setError(err.message || 'Failed to start recording');
            setIsRecording(false);
        }
    };

    // Stop recording - always auto-sends (like text messages)
    const stopRecordingAndSend = useCallback(async () => {
        if (!recordingRef.current || !isRecording) {
            return;
        }

        if (!canSend) {
            return;
        }

        shouldSendDirectlyRef.current = true;
        
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        
        try {
            await recordingRef.current.stopAndUnloadAsync();
            const uri = recordingRef.current.getURI();
            const status = await recordingRef.current.getStatusAsync();
            
            if (uri && status.isLoaded) {
                const duration = Math.round(status.durationMillis / 1000) || recordingTime;
                
                // Create file object for upload
                const fileType = 'audio/m4a'; // iOS/Android default
                
                if (shouldSendDirectlyRef.current && onSendAudioDirect) {
                    setIsUploading(false);
                    setIsRecording(false);
                    setCanSend(false);
                    setRecordingTime(0);
                    
                    // In React Native, we need to create a FormData with the file
                    // For now, we'll pass the URI and let the parent handle it
                    try {
                        await onSendAudioDirect(uri, duration, fileType);
                    } catch (err) {
                        console.error('Error sending audio:', err);
                        setError('Failed to send audio: ' + err.message);
                    }
                    return;
                }
                
                if (onRecordingComplete) {
                    await onRecordingComplete(uri, duration, fileType);
                }
            }
        } catch (err) {
            console.error('Error stopping recording:', err);
            setError('Failed to process recording');
        } finally {
            setIsUploading(false);
            setIsRecording(false);
            setCanSend(false);
            recordingRef.current = null;
        }
    }, [isRecording, canSend, recordingTime, onSendAudioDirect, onRecordingComplete]);

    // Stop recording without sending (cancel)
    const stopRecording = async () => {
        if (recordingRef.current && isRecording) {
            try {
                await recordingRef.current.stopAndUnloadAsync();
            } catch (err) {
                console.error('Error stopping recording:', err);
            }
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setIsRecording(false);
        setCanSend(false);
        recordingRef.current = null;
    };

    // Handle cancel
    const handleCancel = async () => {
        await stopRecording();
        setRecordingTime(0);
        setError(null);
        if (onCancel) {
            onCancel();
        }
    };

    // Mouse/Touch handlers
    const handlePressIn = (e) => {
        if (disabled || isRecording) return;
        touchStartTimeRef.current = Date.now();
        startRecording();
    };

    const handlePressOut = (e) => {
        if (!isRecording) return;
        const holdTime = Date.now() - touchStartTimeRef.current;
        
        if (holdTime < 500) {
            handleCancel();
            return;
        }
        
        if (canSend) {
            shouldSendDirectlyRef.current = true;
            stopRecordingAndSend();
        } else {
            handleCancel();
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return async () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (recordingRef.current) {
                try {
                    await recordingRef.current.stopAndUnloadAsync();
                } catch (err) {
                    console.error('Error cleaning up recording:', err);
                }
            }
        };
    }, []);

    // Expose stopRecordingAndSend function to parent via ref
    useEffect(() => {
        if (onStopRecordingRef) {
            onStopRecordingRef.current = {
                stopAndSend: stopRecordingAndSend,
                isRecording,
                canSend,
            };
        }
    }, [isRecording, canSend, stopRecordingAndSend, onStopRecordingRef]);

    if (isRecording) {
        const waveSeed = recordingTime % 8;
        return (
            <View className="flex-row items-center gap-3 w-full">
                <View className="flex-1 flex-row items-center gap-3 bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3">
                    <View className="flex-row items-center gap-3 flex-1">
                        <View className="relative">
                            <View className="w-4 h-4 bg-red-500 rounded-full" />
                        </View>
                        
                        <View>
                            <View className="flex-row items-baseline gap-2">
                                <Text className="text-lg font-bold text-red-500 tabular-nums">
                                    {formatTime(recordingTime)}
                                </Text>
                                <Text className="text-xs font-medium text-red-500/70">
                                    {canSend ? 'Ready to send' : 'Recording...'}
                                </Text>
                            </View>
                            {error ? (
                                <Text className="text-[11px] font-semibold text-red-600 mt-0.5" numberOfLines={1}>
                                    {error}
                                </Text>
                            ) : null}
                        </View>
                        
                        <View className="flex-row items-end gap-[2px] flex-1 justify-center h-8">
                            {waveBars.map((bar) => (
                                <View
                                    key={bar}
                                    className="w-[3px] bg-red-500/70 rounded-full"
                                    style={{
                                        height: 6 + ((bar + waveSeed) % 7) * 3,
                                        opacity: canSend ? 1 : 0.6,
                                    }}
                                />
                            ))}
                        </View>
                    </View>
                </View>
                
                <View className="flex-row items-center gap-2">
                    {canSend && (
                        <Pressable
                            onPress={stopRecordingAndSend}
                            className="bg-alpha px-4 py-2.5 rounded-xl"
                            disabled={isUploading}
                        >
                            {isUploading ? (
                                <Skeleton width={16} height={16} borderRadius={8} isDark={false} />
                            ) : (
                                <Text className="text-black font-bold">Send</Text>
                            )}
                        </Pressable>
                    )}
                    <Pressable
                        onPress={handleCancel}
                        className="h-10 w-10 items-center justify-center border border-red-500/25 rounded-xl bg-white/40 dark:bg-black/20"
                        disabled={isUploading}
                    >
                        <Ionicons name="close" size={16} color="#ef4444" />
                    </Pressable>
                </View>
            </View>
        );
    }

    return (
        <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            className={`h-10 w-10 items-center justify-center rounded-2xl border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.04] dark:bg-white/[0.06] ${disabled ? 'opacity-50' : ''}`}
            disabled={disabled || isUploading}
        >
            {isUploading ? (
                <Skeleton width={16} height={16} borderRadius={8} isDark={false} />
            ) : (
                <Ionicons name="mic" size={20} color="#ffc801" />
            )}
        </Pressable>
    );
}
