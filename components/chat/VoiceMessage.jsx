import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

export default function VoiceMessage({ 
    audioUrl, 
    duration, 
    isCurrentUser,
    onPlayStateChange 
}) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const soundRef = useRef(null);

    // Format time as 0:00:06 (HH:MM:SS or MM:SS)
    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Play/pause toggle
    const togglePlayback = async () => {
        try {
            if (!soundRef.current) {
                const { sound } = await Audio.Sound.createAsync(
                    { uri: audioUrl },
                    { shouldPlay: true }
                );
                soundRef.current = sound;
                
                sound.setOnPlaybackStatusUpdate((status) => {
                    if (status.isLoaded) {
                        setCurrentTime(status.positionMillis / 1000);
                        setIsPlaying(status.isPlaying);
                        
                        if (status.didJustFinish) {
                            setIsPlaying(false);
                            setCurrentTime(0);
                            if (onPlayStateChange) {
                                onPlayStateChange(false);
                            }
                        }
                    }
                });
                
                setIsPlaying(true);
                if (onPlayStateChange) {
                    onPlayStateChange(true);
                }
            } else {
                const status = await soundRef.current.getStatusAsync();
                if (status.isLoaded) {
                    if (status.isPlaying) {
                        await soundRef.current.pauseAsync();
                        setIsPlaying(false);
                        if (onPlayStateChange) {
                            onPlayStateChange(false);
                        }
                    } else {
                        await soundRef.current.playAsync();
                        setIsPlaying(true);
                        if (onPlayStateChange) {
                            onPlayStateChange(true);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return async () => {
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
            }
        };
    }, []);

    return (
        <View className={`flex-row items-center gap-3 ${isCurrentUser ? 'text-white' : 'text-black dark:text-white'}`}>
            {/* Simple circular play button */}
            <Pressable
                onPress={togglePlayback}
                className={`h-9 w-9 rounded-full items-center justify-center ${isCurrentUser ? 'bg-white' : 'bg-white border border-gray-200 dark:border-gray-700'}`}
            >
                {isPlaying ? (
                    <Ionicons name="pause" size={16} color={isCurrentUser ? '#000' : '#000'} />
                ) : (
                    <Ionicons name="play" size={16} color={isCurrentUser ? '#000' : '#000'} style={{ marginLeft: 2 }} />
                )}
            </Pressable>

            {/* Waveform bars - always visible, animated when playing */}
            <View className="flex-row items-end gap-1 h-6 px-2">
                {[...Array(5)].map((_, i) => {
                    const baseHeights = [12, 18, 14, 20, 16];
                    const baseHeight = baseHeights[i];
                    
                    return (
                        <View
                            key={i}
                            className={`w-1 rounded-full ${isCurrentUser ? 'bg-white' : 'bg-black dark:bg-white'}`}
                            style={{
                                height: isPlaying ? baseHeight + Math.sin(Date.now() / 100 + i) * 5 : baseHeight,
                                opacity: isPlaying ? 1 : 0.6,
                                minHeight: 8
                            }}
                        />
                    );
                })}
            </View>

            {/* Duration display */}
            <View className="flex-1 min-w-0">
                {isPlaying ? (
                    <>
                        <Text className={`text-xs font-medium tabular-nums ${isCurrentUser ? 'text-white/90' : 'text-black/90 dark:text-white/90'}`}>
                            {formatTime(currentTime || 0)}
                        </Text>
                        <Text className={`text-xs tabular-nums opacity-70 ${isCurrentUser ? 'text-white/70' : 'text-black/70 dark:text-white/70'}`}>
                            {formatTime(duration || 0)}
                        </Text>
                    </>
                ) : (
                    <Text className={`text-sm font-medium tabular-nums ${isCurrentUser ? 'text-white' : 'text-black dark:text-white'}`}>
                        {formatTime(duration || 0)}
                    </Text>
                )}
            </View>
        </View>
    );
}
