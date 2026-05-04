import React, { useState, useRef, useEffect, useMemo } from 'react';
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
    const bars = useMemo(() => Array.from({ length: 22 }, (_, i) => i), []);

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

    const safeDuration = Math.max(duration || 0, 1);
    const progress = Math.min((currentTime || 0) / safeDuration, 1);
    const activeBars = Math.max(1, Math.round(progress * bars.length));

    return (
        <View className={`flex-row items-center gap-3 ${isCurrentUser ? 'text-white' : 'text-black dark:text-white'}`}>
            <Pressable
                onPress={togglePlayback}
                className={`h-9 w-9 rounded-full items-center justify-center ${isCurrentUser ? 'bg-white/95' : 'bg-white border border-gray-200 dark:border-gray-700'}`}
            >
                {isPlaying ? (
                    <Ionicons name="pause" size={16} color={isCurrentUser ? '#000' : '#000'} />
                ) : (
                    <Ionicons name="play" size={16} color={isCurrentUser ? '#000' : '#000'} style={{ marginLeft: 2 }} />
                )}
            </Pressable>

            <View className="flex-row items-end gap-[2px] h-7 px-1">
                {bars.map((bar) => {
                    const baseHeight = 6 + (bar % 6) * 2;
                    const isActive = bar < activeBars;
                    return (
                        <View
                            key={bar}
                            className={`w-[3px] rounded-full ${isCurrentUser ? 'bg-white' : 'bg-black dark:bg-white'}`}
                            style={{
                                height: isPlaying && isActive ? baseHeight + 4 : baseHeight,
                                opacity: isActive ? 0.95 : 0.35,
                            }}
                        />
                    );
                })}
            </View>

            <View className="flex-1 min-w-0">
                <Text className={`text-xs font-semibold tabular-nums ${isCurrentUser ? 'text-white/95' : 'text-black/90 dark:text-white/90'}`}>
                    {formatTime(currentTime || 0)} / {formatTime(duration || 0)}
                </Text>
                <View className={`h-1.5 rounded-full mt-1.5 overflow-hidden ${isCurrentUser ? 'bg-white/25' : 'bg-black/15 dark:bg-white/20'}`}>
                    <View
                        className={`${isCurrentUser ? 'bg-white' : 'bg-alpha'} h-full`}
                        style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                </View>
            </View>
        </View>
    );
}
