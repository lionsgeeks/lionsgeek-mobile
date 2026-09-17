import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Image, ActivityIndicator, Animated, Easing, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCallContext } from "@/context/CallContext";
import { useAppContext } from "@/context";
import { useCallRinger } from "@/hooks/useCallRinger";
import API from "@/api";
import { endNativeCallForCallId } from "@/services/callKeep";

export default function IncomingCallScreen() {
  const router = useRouter();
  const { callId: paramCallId } = useLocalSearchParams<{ callId?: string }>();
  const { token } = useAppContext();
  const { incomingCall, activeCall, accept, reject, clearIncomingCall, setActiveCall } = useCallContext();
  const [fetchedCall, setFetchedCall] = useState<{
    callId: number;
    channel_name: string;
    type?: string;
    caller: { id: number; name?: string; avatar?: string | null };
  } | null>(null);
  const [busy, setBusy] = useState(false);

  // When opened from push: we have callId param but no Ably incomingCall – fetch call details
  useEffect(() => {
    if (paramCallId && token && !incomingCall && !fetchedCall) {
      (async () => {
        try {
          const data = await API.getCall(Number(paramCallId), token);
          if (data?.call_id) {
            setFetchedCall({
              callId: data.call_id,
              channel_name: data.channel_name,
              type: data.call_type || data.type || 'audio',
              caller: data.caller || {},
            });
          } else {
            router.replace("/(tabs)/home");
          }
        } catch {
          router.replace("/(tabs)/home");
        }
      })();
    }
  }, [paramCallId, token, incomingCall, fetchedCall]);

  useEffect(() => {
    // Do NOT redirect away while an activeCall exists – accept() has just
    // promoted incomingCall to activeCall and is about to push /call.
    // We also delay slightly because on iOS the state update may not yet
    // be visible through context on the first effect run.
    if (incomingCall || fetchedCall || paramCallId || activeCall) return;
    const timer = setTimeout(() => {
      router.replace("/(tabs)/home");
    }, 400);
    return () => clearTimeout(timer);
  }, [incomingCall, fetchedCall, paramCallId, activeCall, router]);

  const displayCall = incomingCall || (fetchedCall ? {
    callId: fetchedCall.callId,
    channel_name: fetchedCall.channel_name,
    type: fetchedCall.type || 'audio',
    caller: fetchedCall.caller,
  } : null);

  useCallRinger({
    enabled: !!displayCall && !activeCall,
    mode: 'incoming',
  });

  // Pulse animation behind the avatar to add a visual "ring" feel.
  const pulseAnim = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!displayCall) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [displayCall, pulseAnim]);

  const leaveIncoming = async (callId?: number | string | null) => {
    if (callId != null) {
      try { await endNativeCallForCallId(callId); } catch {}
    }
    clearIncomingCall?.();
    setFetchedCall(null);
    try { router.replace("/(tabs)/home"); } catch {}
  };

  const handleAccept = async () => {
    if (busy) return;
    setBusy(true);
    const callId = displayCall?.callId;
    try {
      if (incomingCall) {
        // accept() in CallContext already navigates to /call on success.
        await accept();
        return;
      }
      if (fetchedCall && token) {
        const data = await API.acceptCall(fetchedCall.callId, token);
        if (data?.token && data?.channel_name && setActiveCall) {
          setActiveCall({
            callId: data.call_id,
            channelName: data.channel_name,
            token: data.token,
            appId: data.app_id,
            type: data.type || fetchedCall.type || 'audio',
            isCaller: false,
            caller: fetchedCall.caller,
          });
          setFetchedCall(null);
          router.replace("/(tabs)/call");
          return;
        }
        Alert.alert('Call failed', 'Could not join the call. Please try again.');
        await leaveIncoming(callId);
        return;
      }
    } catch (e) {
      console.error("Accept call error:", e);
      Alert.alert('Call failed', e?.response?.data?.message || e?.message || 'Could not accept the call.');
      await leaveIncoming(callId);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (busy) return;
    setBusy(true);
    const callId = displayCall?.callId;
    try {
      if (incomingCall) {
        await reject();
      } else if (fetchedCall && token) {
        await API.rejectCall(fetchedCall.callId, token);
      }
    } catch (e) {
      console.error("Reject call error:", e);
    } finally {
      setBusy(false);
      await leaveIncoming(callId);
    }
  };

  if (!displayCall) {
    return (
      <View className="flex-1 bg-dark justify-center items-center">
        <ActivityIndicator size="large" color="#fff" />
        <Text className="text-white mt-4">Loading call...</Text>
      </View>
    );
  }

  const caller = displayCall.caller || {};
  const avatarUri = caller.avatar
    ? `${API.APP_URL}/storage/img/profile/${caller.avatar}`
    : null;

  return (
    <View className="flex-1 bg-dark justify-center items-center px-8">
      <Text className="text-white/70 text-lg mb-2">
        {displayCall.type === 'video' ? 'Incoming video call' : 'Incoming audio call'}
      </Text>
      <View style={{ width: 200, height: 200, marginBottom: 24, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 200,
            height: 200,
            borderRadius: 100,
            backgroundColor: 'rgba(34,197,94,0.18)',
            opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
            transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.6] }) }],
          }}
        />
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 160,
            height: 160,
            borderRadius: 80,
            backgroundColor: 'rgba(34,197,94,0.25)',
            opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
            transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.4] }) }],
          }}
        />
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            className="w-28 h-28 rounded-full bg-white/20"
            resizeMode="cover"
          />
        ) : (
          <View className="w-28 h-28 rounded-full bg-white/20 items-center justify-center">
            <Ionicons name="person" size={56} color="rgba(255,255,255,0.6)" />
          </View>
        )}
      </View>
      <Text className="text-white text-2xl font-bold mb-12">
        {caller.name || "Unknown"}
      </Text>

      <View className="flex-row gap-12">
        <TouchableOpacity
          onPress={handleReject}
          className="items-center"
          activeOpacity={0.8}
          disabled={busy}
        >
          <View className="w-20 h-20 rounded-full bg-red-500 items-center justify-center">
            <Ionicons
              name="call"
              size={36}
              color="#fff"
              style={{ transform: [{ rotate: '135deg' }] }}
            />
          </View>
          <Text className="text-white mt-2 font-medium">Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleAccept}
          className="items-center"
          activeOpacity={0.8}
          disabled={busy}
        >
          <View className="w-20 h-20 rounded-full bg-green-500 items-center justify-center">
            <Ionicons name="call" size={36} color="#fff" />
          </View>
          <Text className="text-white mt-2 font-medium">Accept</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
