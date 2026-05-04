import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Component dial audio recording style Instagram m3a waves animation w timer
export default function AudioRecorder({ onSend, onCancel, isRecording, recordingTime, isPaused, onPause, onResume }) {
    const animationRef = useRef(null);
    const barsRef = useRef([]);
    const bars = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

    // Animation dial waves bach tban b7al real audio
    useEffect(() => {
        if (!isRecording) {
            if (animationRef.current) {
                clearInterval(animationRef.current);
            }
            return;
        }

        const animate = () => {
            barsRef.current.forEach((bar, index) => {
                if (bar) {
                    // In React Native, we'll use Animated API or just update style
                }
            });
        };

        animationRef.current = setInterval(animate, 50);
        return () => {
            if (animationRef.current) {
                clearInterval(animationRef.current);
            }
        };
    }, [isRecording]);

    // Format dial time (MM:SS)
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <View className="flex-row items-center gap-2 p-2.5 bg-alpha/15 rounded-2xl border border-alpha/30">
            <Pressable
                onPress={onCancel}
                className="h-8 w-8 items-center justify-center"
            >
                <Ionicons name="close" size={16} color="#ffc801" />
            </Pressable>

            {/* Pause/Resume Button */}
            {isPaused ? (
                <Pressable
                    onPress={onResume}
                    className="h-8 w-8 items-center justify-center"
                >
                    <Ionicons name="play" size={16} color="#ffc801" />
                </Pressable>
            ) : (
                <Pressable
                    onPress={onPause}
                    className="h-8 w-8 items-center justify-center"
                >
                    <Ionicons name="pause" size={16} color="#ffc801" />
                </Pressable>
            )}

            <View className="flex-1 flex-row items-center gap-2">
                <View className={`h-3 w-3 bg-yellow-500 rounded-full ${isPaused ? '' : 'opacity-100'}`} />
                <Text className="text-sm font-medium text-black dark:text-white tabular-nums min-w-[3rem]">
                    {formatTime(recordingTime)}
                </Text>
                <View className="flex-1 h-8 flex-row items-end justify-center gap-[2px]">
                    {bars.map((bar) => (
                        <View
                            key={bar}
                            className={`w-[3px] bg-yellow-500 rounded-full ${isRecording && !isPaused ? 'opacity-100' : 'opacity-35'}`}
                            style={{ height: 6 + ((bar + recordingTime) % 8) * 2 }}
                        />
                    ))}
                </View>
            </View>

            <Pressable
                onPress={onSend}
                className="h-9 w-9 items-center justify-center bg-yellow-500 rounded-lg"
            >
                <Ionicons name="send" size={16} color="#000" />
            </Pressable>
        </View>
    );
}
