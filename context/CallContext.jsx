import { createContext, useContext, useState, useRef, useEffect, useCallback } from "react";
import * as Ably from "ably";
import API from "@/api";
import { useRouter } from "expo-router";
import { useAppContext } from "@/context";
import { getAgoraAppId } from "@/hooks/useAgoraCall";
import { withCallApiRetry } from "@/utils/callApiRetry";
import {
    setupCallKeep,
    displayNativeIncomingCall,
    endNativeCallForCallId,
    endAllNativeCalls,
    bindCallKeepListeners,
    isCallKeepAvailable,
} from "@/services/callKeep";

const CallContext = createContext(null);

function mapCallPayload(data, overrides = {}) {
    const call = data?.call || {};
    const type = data?.type || call?.type || overrides.type || 'audio';
    return {
        callId: data?.call_id || call?.id,
        channelName: data?.channel_name || call?.channel_name,
        token: data?.token,
        appId: data?.app_id || getAgoraAppId(),
        uid: data?.uid,
        type,
        caller: call?.caller || overrides.caller || null,
        callee: call?.callee || overrides.callee || null,
        ...overrides,
    };
}

export function CallProvider({ children }) {
    const { user, token } = useAppContext();
    const router = useRouter();
    const [incomingCall, setIncomingCall] = useState(null);
    const [activeCall, setActiveCall] = useState(null);
    const [pendingCallAsCaller, setPendingCallAsCaller] = useState(null);
    const ablyClientRef = useRef(null);
    const channelRef = useRef(null);
    const pendingCallRef = useRef(null);
    const incomingCallRef = useRef(null);
    const activeCallRef = useRef(null);
    const tokenRef = useRef(null);
    pendingCallRef.current = pendingCallAsCaller;
    incomingCallRef.current = incomingCall;
    activeCallRef.current = activeCall;
    tokenRef.current = token;

    const channelName = user?.id ? `call:user:${user.id}` : null;

    const leaveToHome = useCallback(() => {
        setActiveCall(null);
        setIncomingCall(null);
        setPendingCallAsCaller(null);
        try { router.replace("/(tabs)/home"); } catch (_) {}
    }, [router]);

    const presentIncoming = useCallback(async (payload) => {
        if (!payload?.callId) return;
        setIncomingCall(payload);
        const callerName = payload?.caller?.name || 'LionsGeek user';
        await displayNativeIncomingCall({
            callId: payload.callId,
            callerName,
            callType: payload.type || 'audio',
        });
        try {
            router.replace("/(tabs)/incoming-call");
        } catch (_) {}
    }, [router]);

    // Native CallKeep setup + answer/decline from system UI
    useEffect(() => {
        if (!token || !user?.id) return undefined;
        let cleanupKeep = () => {};
        let cleanupVoip = () => {};
        (async () => {
            await setupCallKeep();
            cleanupKeep = bindCallKeepListeners({
                onAnswer: async (meta) => {
                    const auth = tokenRef.current;
                    if (!auth || !meta?.callId) return;
                    try {
                        const data = await withCallApiRetry(() => API.acceptCall(meta.callId, auth));
                        if (data?.token && data?.channel_name) {
                            setActiveCall(mapCallPayload(data, {
                                isCaller: false,
                                type: data.type || meta.callType || 'audio',
                                caller: { name: meta.callerName },
                            }));
                            setIncomingCall(null);
                            setTimeout(() => router.replace('/(tabs)/call'), 0);
                            return;
                        }
                        console.error('[CallContext] CallKeep answer missing Agora fields');
                        await endNativeCallForCallId(meta.callId);
                        setIncomingCall(null);
                        try { router.replace('/(tabs)/home'); } catch (_) {}
                    } catch (err) {
                        console.error('[CallContext] CallKeep answer failed', err?.response?.data || err?.message);
                        await endNativeCallForCallId(meta.callId);
                        setIncomingCall(null);
                        try { router.replace('/(tabs)/home'); } catch (_) {}
                    }
                },
                onEnd: async (meta) => {
                    const auth = tokenRef.current;
                    if (!auth || !meta?.callId) return;
                    const active = activeCallRef.current;
                    const incoming = incomingCallRef.current;
                    try {
                        if (active?.callId && String(active.callId) === String(meta.callId)) {
                            await withCallApiRetry(() => API.endCall(meta.callId, auth));
                            setActiveCall(null);
                        } else if (incoming?.callId && String(incoming.callId) === String(meta.callId)) {
                            await withCallApiRetry(() => API.rejectCall(meta.callId, auth));
                            setIncomingCall(null);
                        } else {
                            await withCallApiRetry(() => API.endCall(meta.callId, auth)).catch(() =>
                                withCallApiRetry(() => API.rejectCall(meta.callId, auth))
                            );
                        }
                    } catch (e) {
                        console.error('[CallContext] CallKeep end failed', e?.response?.data || e?.message);
                    } finally {
                        if (!activeCallRef.current) {
                            try { router.replace('/(tabs)/home'); } catch (_) {}
                        }
                    }
                },
            });

            try {
                // eslint-disable-next-line global-require
                const { startVoipPushRegistration, sendVoipTokenToBackend } = require('@/services/voipPush');
                cleanupVoip = startVoipPushRegistration(async (voipToken) => {
                    await sendVoipTokenToBackend(voipToken, token);
                });
            } catch (e) {
                if (__DEV__) console.warn('[CallContext] VoIP setup', e?.message);
            }
        })();
        return () => {
            cleanupKeep?.();
            cleanupVoip?.();
        };
    }, [token, user?.id, router]);

    useEffect(() => {
        if (!token || !user?.id || !channelName) {
            if (ablyClientRef.current) {
                ablyClientRef.current.close();
                ablyClientRef.current = null;
                channelRef.current = null;
            }
            return;
        }

        let mounted = true;
        (async () => {
            try {
                const initialTokenData = await API.getCallAblyToken(token);
                if (!mounted || !initialTokenData?.token) return;

                const client = new Ably.Realtime({
                    authCallback: async (_tokenParams, callback) => {
                        try {
                            const fresh = await API.getCallAblyToken(token);
                            if (!fresh?.token) {
                                callback('Failed to fetch Ably token', null);
                                return;
                            }
                            callback(null, fresh.token);
                        } catch (err) {
                            callback(err?.message || 'Ably token request failed', null);
                        }
                    },
                });
                ablyClientRef.current = client;
                const channel = client.channels.get(channelName);
                channelRef.current = channel;

                channel.subscribe("incoming-call", async (msg) => {
                    const data = msg.data;
                    if (!data?.call_id) return;
                    await presentIncoming({
                        callId: data.call_id,
                        channel_name: data.channel_name,
                        type: data.call_type || data.type || 'audio',
                        caller: data.caller || {},
                    });
                });

                channel.subscribe("call-accepted", (msg) => {
                    const data = msg.data;
                    const pending = pendingCallRef.current;
                    if (data?.call_id && pending?.callId === data.call_id) {
                        setActiveCall({
                            ...pending,
                            isCaller: true,
                            type: data.call_type || pending.type || 'audio',
                        });
                        setPendingCallAsCaller(null);
                        setTimeout(() => router.replace("/(tabs)/call"), 0);
                    }
                });

                const clearOutgoing = () => {
                    setPendingCallAsCaller(null);
                    if (!activeCallRef.current) {
                        try { router.replace("/(tabs)/home"); } catch (_) {}
                    }
                };

                channel.subscribe("call-rejected", clearOutgoing);
                channel.subscribe("call-cancelled", async (msg) => {
                    const callId = msg?.data?.call_id;
                    if (callId) await endNativeCallForCallId(callId);
                    setIncomingCall(null);
                    setPendingCallAsCaller(null);
                    if (!activeCallRef.current) leaveToHome();
                });
                channel.subscribe("call-missed", async (msg) => {
                    const callId = msg?.data?.call_id;
                    if (callId) await endNativeCallForCallId(callId);
                    leaveToHome();
                });
                channel.subscribe("call-ended", async (msg) => {
                    const callId = msg?.data?.call_id;
                    if (callId) await endNativeCallForCallId(callId);
                    else await endAllNativeCalls();
                    leaveToHome();
                });
            } catch (e) {
                console.error("[CallContext] Ably init error:", e);
            }
        })();

        return () => {
            mounted = false;
            if (ablyClientRef.current) {
                ablyClientRef.current.close();
                ablyClientRef.current = null;
                channelRef.current = null;
            }
        };
    }, [token, user?.id, channelName, router, leaveToHome, presentIncoming]);

    const initiate = useCallback(
        async (calleeId, type = 'audio') => {
            if (!token) throw new Error("Not authenticated");
            const data = await API.initiateCall(calleeId, token, type);
            if (!data?.call_id) throw new Error(data?.message || "Failed to start call");
            const callee = data?.call?.callee || { id: calleeId, name: null, image: null };
            setPendingCallAsCaller({
                ...mapCallPayload(data, {
                    isCaller: true,
                    calleeId,
                    callee: { id: callee.id, name: callee.name, image: callee.image ?? callee.avatar },
                    type: data.type || type,
                }),
            });
            setTimeout(() => router.replace("/(tabs)/outgoing-call"), 0);
            return data;
        },
        [token, router]
    );

    const cancelPendingCall = useCallback(
        async () => {
            const pending = pendingCallRef.current;
            if (!pending?.callId || !token) {
                setPendingCallAsCaller(null);
                return;
            }
            try {
                await withCallApiRetry(async () => {
                    if (API.cancelCall) return API.cancelCall(pending.callId, token);
                    return API.endCall(pending.callId, token);
                });
            } catch (e) {
                console.error("[CallContext] Cancel call error:", e?.response?.data || e?.message);
            }
            setPendingCallAsCaller(null);
            router.replace("/(tabs)/home");
        },
        [token, router]
    );

    const accept = useCallback(
        async () => {
            if (!incomingCall?.callId || !token) return null;
            let data;
            try {
                data = await withCallApiRetry(() => API.acceptCall(incomingCall.callId, token));
            } catch (err) {
                console.error('[CallContext] API.acceptCall failed', err?.response?.data || err?.message);
                setIncomingCall(null);
                await endNativeCallForCallId(incomingCall.callId);
                throw err;
            }

            if (data?.token && data?.channel_name) {
                setActiveCall(mapCallPayload(data, {
                    isCaller: false,
                    type: data.type || incomingCall.type || 'audio',
                    caller: incomingCall.caller,
                }));
            }
            setIncomingCall(null);
            if (data?.token && data?.channel_name) {
                setTimeout(() => router.replace('/(tabs)/call'), 0);
            }
            return data;
        },
        [incomingCall, token, router]
    );

    const reject = useCallback(async () => {
        if (!incomingCall?.callId || !token) return;
        const callId = incomingCall.callId;
        try {
            await withCallApiRetry(() => API.rejectCall(callId, token));
        } catch (e) {
            console.error('[CallContext] reject failed', e?.response?.data || e?.message);
        } finally {
            await endNativeCallForCallId(callId);
            setIncomingCall(null);
        }
    }, [incomingCall, token]);

    const end = useCallback(
        async () => {
            const callId = activeCallRef.current?.callId;
            const auth = tokenRef.current;
            if (!callId || !auth) {
                setActiveCall(null);
                setPendingCallAsCaller(null);
                return;
            }
            try {
                await withCallApiRetry(() => API.endCall(callId, auth));
            } catch (e) {
                console.error('[CallContext] endCall failed', e?.response?.data || e?.message);
                // Still clear local state, but surface for debugging — server cleanup will expire stale rows.
                throw e;
            } finally {
                await endNativeCallForCallId(callId);
                setActiveCall(null);
                setPendingCallAsCaller(null);
            }
        },
        []
    );

    const clearIncomingCall = useCallback(() => {
        setIncomingCall(null);
    }, []);
    const clearActiveCall = useCallback(() => {
        setActiveCall(null);
    }, []);

    const value = {
        incomingCall,
        activeCall,
        pendingCallAsCaller,
        initiate,
        accept,
        reject,
        end,
        cancelPendingCall,
        clearIncomingCall,
        clearActiveCall,
        setActiveCall,
        presentIncoming,
        callKeepAvailable: isCallKeepAvailable(),
    };

    return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

const noop = () => {};
const noopAsync = async () => {};
const safeDefault = {
    incomingCall: null,
    activeCall: null,
    pendingCallAsCaller: null,
    initiate: noopAsync,
    accept: noopAsync,
    reject: noopAsync,
    end: noopAsync,
    cancelPendingCall: noopAsync,
    clearIncomingCall: noop,
    clearActiveCall: noop,
    setActiveCall: noop,
    presentIncoming: noopAsync,
    callKeepAvailable: false,
};

export function useCallContext() {
    try {
        const ctx = useContext(CallContext);
        return ctx ?? safeDefault;
    } catch (_) {
        return safeDefault;
    }
}
