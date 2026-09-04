import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { View, useColorScheme } from "react-native";
import { colorScheme as nwColorScheme } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ThemeTransitionOverlay from "@/components/theme/ThemeTransitionOverlay";
import API from "@/api";
import { getAuthToken, removeAuthToken, setAuthToken } from "@/utils/authTokenStorage";

const THEME_STORAGE_KEY = 'app_theme_preference';

/** Fields persisted to AsyncStorage for cold-start UI gates. Full profile stays in memory. */
function toAuthUserStub(nextUser) {
    if (!nextUser || typeof nextUser !== 'object') return null;
    const stub = {
        id: nextUser.id,
        name: nextUser.name,
        image: nextUser.image,
        access_scan: nextUser.access_scan,
    };
    if (nextUser.role !== undefined) stub.role = nextUser.role;
    if (nextUser.roles !== undefined) stub.roles = nextUser.roles;
    return stub;
}

const appContext = createContext();

const AppProvider = ({ children }) => {
    const [language, setLanguage] = useState("en");
    const [token, setToken] = useState(null);
    const [user, setUser] = useState(null);
    // Mirror NativeWind's reactive colorScheme into local state so consumers re-render on toggle
    const systemScheme = useColorScheme();
    const [colorScheme, setColorSchemeState] = useState(systemScheme ?? 'light');
    const themeTransitionRef = useRef(null);

    useEffect(() => {
        (async () => {
            // Restore auth session
            const t = await getAuthToken();
            const u = await AsyncStorage.getItem('auth_user');
            if (t) {
                setToken(t);
            }
            if (u) {
                try {
                    const parsedUser = JSON.parse(u);
                    setUser(parsedUser);
                } catch (e) {
                    if (__DEV__) console.error('[CONTEXT] Failed to parse user data:', e);
                }
            }

            // Restore saved theme preference and apply to NativeWind
            const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
            if (savedTheme === 'dark' || savedTheme === 'light') {
                nwColorScheme.set(savedTheme);
                setColorSchemeState(savedTheme);
            }
        })();
    }, []);

    const saveAuth = async (nextToken, nextUser) => {
        // Validate token
        if (!nextToken) {
            throw new Error('Invalid token: token is required');
        }
        
        const tokenStr = String(nextToken).trim();
        if (!tokenStr || tokenStr === 'false' || tokenStr === 'null' || tokenStr === 'undefined') {
            throw new Error(`Invalid token: cannot be "${tokenStr}"`);
        }
        
        // Update state with full profile; persist a minimal stub only.
        setToken(tokenStr);
        setUser(nextUser);
        
        await setAuthToken(tokenStr);
        await AsyncStorage.setItem('auth_user', JSON.stringify(toAuthUserStub(nextUser)));
    };

    const signOut = async () => {
        let tokenToRevoke = token;
        if (!tokenToRevoke) {
            tokenToRevoke = await getAuthToken();
        }

        try {
            if (
                tokenToRevoke &&
                tokenToRevoke !== 'false' &&
                tokenToRevoke !== 'null' &&
                String(tokenToRevoke).trim() !== ''
            ) {
                await API.postWithAuth('mobile/logout', {}, tokenToRevoke);
            }
        } catch {
            // Token may already be invalid or the network may be unavailable.
        }

        setToken(null);
        setUser(null);
        await removeAuthToken();
        await AsyncStorage.removeItem('auth_user');
    };

    const applyTheme = useCallback((theme) => {
        setColorSchemeState(theme);
        nwColorScheme.set(theme);
        AsyncStorage.setItem(THEME_STORAGE_KEY, theme).catch((error) => {
            console.error('[CONTEXT] Failed to persist theme:', error);
        });
    }, []);

    /** Sun/moon fullscreen transition (1s) then apply theme; falls back to instant apply. */
    const setTheme = useCallback((theme) => {
        if (theme !== 'dark' && theme !== 'light') return;
        if (theme === colorScheme) return;
        if (themeTransitionRef.current?.animate) {
            themeTransitionRef.current.animate(theme);
            return;
        }
        applyTheme(theme);
    }, [colorScheme, applyTheme]);

    const appValue = {
        language,
        setLanguage,
        colorScheme,
        setTheme,
        token,
        user,
        saveAuth,
        signOut,
    };
    return (
        <appContext.Provider value={appValue}>
            <View style={{ flex: 1 }}>
                {children}
                <ThemeTransitionOverlay
                    ref={themeTransitionRef}
                    colorScheme={colorScheme}
                    onApplyTheme={applyTheme}
                />
            </View>
        </appContext.Provider>
    );
};

const useAppContext = () => useContext(appContext);

export { AppProvider, appContext, useAppContext };
