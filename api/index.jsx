import axios from "axios";
import {
    getEvents,
    getEvent,
    storeEventBooking,
    validateEventInvitation,
    manualEventChecking,
} from './apiProxy';

const APP_URL = process.env.EXPO_PUBLIC_APP_URL;

const ensureAppUrl = () => {
    const value = typeof APP_URL === 'string' ? APP_URL.trim() : '';
    if (!value) {
        throw new Error(
            'EXPO_PUBLIC_APP_URL is not set. Create a .env file (see .env.example) and restart Expo.'
        );
    }
    return value.replace(/\/+$/, '');
};

const IMAGE_URL = APP_URL ? `${APP_URL}/storage/images` : '';
const VIDEO_URL = APP_URL ? `${APP_URL}/storage/videos` : '';

const logApiError = (error, method, url, endpoint, options = {}) => {
    if (options.silent) return;
    const status = error?.response?.status;
    if (status === 503 && endpoint.includes('attendance/slot-status')) return;

    const errorData = error?.response?.data;
    const errorMessage = typeof errorData === 'object' && errorData !== null
        ? (errorData.message ?? JSON.stringify(errorData, null, 2))
        : (errorData || error?.message || 'Unknown error');
    if (__DEV__) {
        console.log(`API ERROR\nMethod: ${method}\nURL: ${url}\nEndpoint: ${endpoint}\nError: ${errorMessage}`);
        if (status) {
            console.log(`Status: ${status}`);
        }
    }
};

const getPublic = async (endpoint) => {
    try {
        const baseUrl = ensureAppUrl();
        const url = `${baseUrl}/api/${endpoint}`;
        const response = await axios.get(url, {
            headers: {
                Accept: 'application/json',
            },
        });

        if (typeof response.data === 'string') {
            const jsonMatch = response.data.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    response.data = JSON.parse(jsonMatch[0]);
                } catch (parseError) {
                    console.log(`API WARNING: Failed to parse JSON from response for ${endpoint}`);
                }
            }
        }

        return response;
    } catch (error) {
        const baseUrl = (() => {
            try { return ensureAppUrl(); } catch { return ''; }
        })();
        const url = baseUrl ? `${baseUrl}/api/${endpoint}` : `/api/${endpoint}`;
        logApiError(error, 'GET (public)', url, endpoint);
        throw error;
    }
};

const get = async (endpoint, Token, options = {}) => {
    try {
        const baseUrl = ensureAppUrl();
        // Token is REQUIRED for all API calls
        if (!Token) {
            throw new Error('Authentication token is required');
        }

        const headers = {
            'Authorization': `Bearer ${Token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };

        const url = `${baseUrl}/api/${endpoint}`;
        const response = await axios.get(url, { headers });
        
        // Handle case where response.data is a string with HTML warnings + JSON
        if (typeof response.data === 'string') {
            // Extract JSON from string (find the JSON object)
            const jsonMatch = response.data.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    response.data = JSON.parse(jsonMatch[0]);
                } catch (parseError) {
                    console.log(`API WARNING: Failed to parse JSON from response for ${endpoint}`);
                    // Keep original response.data if parsing fails
                }
            }
        }
        
        return response;
    } catch (error) {
        const baseUrl = (() => {
            try { return ensureAppUrl(); } catch { return ''; }
        })();
        const url = baseUrl ? `${baseUrl}/api/${endpoint}` : `/api/${endpoint}`;
        logApiError(error, 'GET', url, endpoint, options);
        throw error;
    }
};



const post = async (endpoint, data, Token) => {
    try {
        const baseUrl = ensureAppUrl();
        // Token is REQUIRED for all API calls (except login/forgot-password)
        const headers = {
            'Accept': 'application/json',
        };

        // Check if data is FormData (React Native FormData)
        // In React Native, FormData is a global, so we check for it
        const isFormData = data && (
            (typeof FormData !== 'undefined' && data instanceof FormData) ||
            (data.constructor && data.constructor.name === 'FormData') ||
            (data._parts !== undefined) // React Native FormData has _parts
        );

        // For JSON, we set application/json.
        // For FormData (uploads), axios-on-RN is more reliable when explicitly
        // using multipart/form-data (boundary is handled by the native layer).
        if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        } else {
            headers['Content-Type'] = 'multipart/form-data';
        }

        if (Token) {
            headers['Authorization'] = `Bearer ${Token}`;
        }

        const url = `${baseUrl}/api/${endpoint}`;
        const response = await axios.post(url, data, {
            headers,
            // Avoid custom transformRequest for FormData — it can break multipart in RN and cause Network Error
            timeout: 30000,
        });
        
        // Handle case where response.data is a string with HTML warnings + JSON
        if (typeof response.data === 'string') {
            // Extract JSON from string (find the JSON object)
            const jsonMatch = response.data.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    response.data = JSON.parse(jsonMatch[0]);
                } catch (parseError) {
                    console.log(`API WARNING: Failed to parse JSON from response for ${endpoint}`);
                    // Keep original response.data if parsing fails
                }
            }
        }
        
        return response;
    } catch (error) {
        const baseUrl = (() => {
            try { return ensureAppUrl(); } catch { return ''; }
        })();
        const url = baseUrl ? `${baseUrl}/api/${endpoint}` : `/api/${endpoint}`;
        const status = error?.response?.status;
        const errorData = error?.response?.data;
        const errorMessage = typeof errorData === 'object'
            ? JSON.stringify(errorData, null, 2)
            : (errorData || error?.message || 'Unknown error');
        console.log(`API ERROR\nMethod: POST\nURL: ${url}\nEndpoint: ${endpoint}\nStatus: ${status ?? 'unknown'}\nError: ${errorMessage}`);
        throw error;
    }
};



const put = async (endpoint, Token, data) => {
    try {
        const baseUrl = ensureAppUrl();
        if (!Token) {
            throw new Error('Authentication token is required');
        }

        const headers = {
            'Authorization': `Bearer ${Token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };

        const url = `${baseUrl}/api/${endpoint}`;
        const response = await axios.put(url, data, { headers });
        return response;
    } catch (error) {
        const baseUrl = (() => {
            try { return ensureAppUrl(); } catch { return ''; }
        })();
        const url = baseUrl ? `${baseUrl}/api/${endpoint}` : `/api/${endpoint}`;
        const errorData = error?.response?.data;
        const errorMessage = typeof errorData === 'object'
            ? JSON.stringify(errorData, null, 2)
            : (errorData || error?.message || 'Unknown error');
        console.log(`API ERROR\nMethod: PUT\nURL: ${url}\nEndpoint: ${endpoint}\nError: ${errorMessage}`);
        throw error;
    }
};


//* Keep this just in case. For updating participants
// export const update_visitor = async (Token, first_name, last_name) => {
//     try {
//         const response = await axios.put(`${APP_URL}/api/visitor`, { first_name, last_name }, {
//             headers: { Token },
//         })
//         return response;
//     } catch (error) {

//         console.log("API ERROR:", error);

//     }
// }


const remove = async (endpoint, Token) => {
    try {
        const baseUrl = ensureAppUrl();
        if (!Token) {
            throw new Error('Authentication token is required');
        }

        const headers = {
            'Authorization': `Bearer ${Token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };

        const url = `${baseUrl}/api/${endpoint}`;
        const response = await axios.delete(url, { headers });
        return response;
    } catch (error) {
        const baseUrl = (() => {
            try { return ensureAppUrl(); } catch { return ''; }
        })();
        const url = baseUrl ? `${baseUrl}/api/${endpoint}` : `/api/${endpoint}`;
        const errorData = error?.response?.data;
        const errorMessage = typeof errorData === 'object'
            ? JSON.stringify(errorData, null, 2)
            : (errorData || error?.message || 'Unknown error');
        console.log(`API ERROR\nMethod: DELETE\nURL: ${url}\nEndpoint: ${endpoint}\nError: ${errorMessage}`);
        throw error;
    }
};

// Mobile API helpers with token from context
const getWithAuth = async (endpoint, token, options = {}) => {
    return get(endpoint, token, options);
};
const postWithAuth = async (endpoint, data, token) => {
    return post(endpoint, data, token);
};

// ---------------------------------------------------------------------------
// Stories
//   GET    /api/mobile/stories                  → { groups: [...] }
//   POST   /api/mobile/stories  (multipart)     → { story }
//   POST   /api/mobile/stories/{id}/view        → { ok }
//   DELETE /api/mobile/stories/{id}             → { ok }
// ---------------------------------------------------------------------------

const listStories = async (token) => {
    const response = await get('mobile/stories', token);
    return response?.data;
};

const createStory = async ({ uri, type, durationMs, width, height, mimeType, audience, overlays, textStory, bgColor, audio, stickers, layoutCells, boomerang }, token) => {
    const form = new FormData();
    const isVideo = type === 'video';
    if (textStory) {
        form.append('text_story', '1');
        form.append('media_type', 'image');
        if (bgColor) form.append('bg_color', bgColor);
    } else {
        const fallbackName = isVideo ? `story_${Date.now()}.mp4` : `story_${Date.now()}.jpg`;
        const fallbackMime = isVideo ? 'video/mp4' : 'image/jpeg';
        let uploadUri = uri;
        if (typeof uploadUri === 'string' && uploadUri.startsWith('/') && !uploadUri.startsWith('file://')) {
            uploadUri = `file://${uploadUri}`;
        }
        form.append('media', {
            uri: uploadUri,
            name: fallbackName,
            type: mimeType || fallbackMime,
        });
        form.append('media_type', isVideo ? 'video' : 'image');
    }
    if (durationMs) {
        let ms = Number(durationMs);
        if (Number.isFinite(ms) && ms > 0 && ms < 1000) ms = Math.round(ms * 1000);
        if (Number.isFinite(ms) && ms > 0) form.append('duration_ms', String(Math.round(ms)));
    }
    if (width)      form.append('width', String(Math.round(width)));
    if (height)     form.append('height', String(Math.round(height)));
    if (audience === 'close_friends' || audience === 'public') {
        form.append('audience', audience);
    }
    if (Array.isArray(overlays) && overlays.length > 0) {
        form.append('overlays', JSON.stringify(overlays));
    }
    if (audio?.uri) {
        form.append('audio', {
            uri: audio.uri,
            name: audio.name || `story_audio_${Date.now()}.m4a`,
            type: audio.mimeType || 'audio/mpeg',
        });
    }
    if (stickers && typeof stickers === 'object') {
        Object.entries(stickers).forEach(([id, file]) => {
            if (!file?.uri) return;
            form.append(`sticker_${id}`, {
                uri: file.uri,
                name: file.name || `sticker_${id}.jpg`,
                type: file.mimeType || 'image/jpeg',
            });
        });
    }
    if (Array.isArray(layoutCells)) {
        layoutCells.forEach((file, i) => {
            if (!file?.uri) return;
            form.append(`layout_cell_${i}`, {
                uri: file.uri,
                name: file.name || `layout_${i}.jpg`,
                type: file.mimeType || 'image/jpeg',
            });
        });
    }
    if (Array.isArray(boomerang)) {
        boomerang.forEach((file) => {
            if (!file?.uri) return;
            form.append('boomerang[]', {
                uri: file.uri,
                name: file.name || `boom.jpg`,
                type: file.mimeType || 'image/jpeg',
            });
        });
    }
    const response = await post('mobile/stories', form, token);
    return response?.data;
};

const reportStory = async (storyId, reason, token) => {
    const response = await post(`mobile/stories/${storyId}/report`, { reason }, token);
    return response?.data;
};

const listStoryArchive = async (token) => {
    const response = await get('mobile/stories/archive', token);
    return response?.data;
};

const reshareStory = async (storyId, token) => {
    const response = await post(`mobile/stories/${storyId}/reshare`, {}, token);
    return response?.data;
};

const shareStory = async (storyId, userId, token) => {
    const response = await post(`mobile/stories/${storyId}/share`, { user_id: userId }, token);
    return response?.data;
};

const interactWithStory = async (storyId, overlayId, value, token) => {
    const response = await post(`mobile/stories/${storyId}/interact`, { overlay_id: overlayId, value }, token);
    return response?.data;
};

const getStoryInteractions = async (storyId, token) => {
    const response = await get(`mobile/stories/${storyId}/interactions`, token);
    return response?.data;
};

const blockUser = async (userId, token) => {
    const response = await post(`mobile/users/${userId}/block`, {}, token);
    return response?.data;
};

const viewStory = async (storyId, token) => {
    const response = await post(`mobile/stories/${storyId}/view`, {}, token);
    return response?.data;
};

const deleteStory = async (storyId, token) => {
    const response = await remove(`mobile/stories/${storyId}`, token);
    return response?.data;
};

const getStoryViewers = async (storyId, token) => {
    const response = await get(`mobile/stories/${storyId}/viewers`, token);
    return response?.data;
};

const reactToStory = async (storyId, emoji, token) => {
    const response = await post(`mobile/stories/${storyId}/react`, { emoji }, token);
    return response?.data;
};

const removeStoryReaction = async (storyId, token) => {
    const response = await remove(`mobile/stories/${storyId}/react`, token);
    return response?.data;
};

const replyToStory = async (storyId, message, token) => {
    const response = await post(`mobile/stories/${storyId}/reply`, { message }, token);
    return response?.data;
};

const repostStoryFromMention = async (storyId, token) => {
    const response = await post(`mobile/stories/${storyId}/mention-repost`, {}, token);
    return response?.data;
};

const reportStoryCaptureEvent = async (storyId, kind, token) => {
    const response = await post(`mobile/stories/${storyId}/capture-event`, { kind }, token);
    return response?.data;
};

// ─── Highlights ───────────────────────────────────────────────────────────
const listHighlights = async (userId, token) => {
    const response = await get(`mobile/users/${userId}/highlights`, token);
    return response?.data;
};

const getHighlight = async (highlightId, token) => {
    const response = await get(`mobile/highlights/${highlightId}`, token);
    return response?.data;
};

const createHighlight = async ({ title, storyId }, token) => {
    const response = await post(
        `mobile/highlights`,
        { title, story_id: storyId },
        token,
    );
    return response?.data;
};

const addStoryToHighlight = async (highlightId, storyId, token) => {
    const response = await post(
        `mobile/highlights/${highlightId}/stories`,
        { story_id: storyId },
        token,
    );
    return response?.data;
};

const removeStoryFromHighlight = async (highlightId, storyId, token) => {
    const response = await remove(
        `mobile/highlights/${highlightId}/stories/${storyId}`,
        token,
    );
    return response?.data;
};

const deleteHighlight = async (highlightId, token) => {
    const response = await remove(`mobile/highlights/${highlightId}`, token);
    return response?.data;
};

const updateHighlight = async (highlightId, { title, coverStoryId }, token) => {
    const payload = {};
    if (title) payload.title = title;
    if (coverStoryId) payload.cover_story_id = coverStoryId;
    const response = await put(`mobile/highlights/${highlightId}`, token, payload);
    return response?.data;
};

// ─── Close friends ────────────────────────────────────────────────────────
const listCloseFriends = async (token) => {
    const response = await get(`mobile/close-friends`, token);
    return response?.data;
};

const addCloseFriend = async (friendId, token) => {
    const response = await post(`mobile/close-friends/${friendId}`, {}, token);
    return response?.data;
};

const removeCloseFriend = async (friendId, token) => {
    const response = await remove(`mobile/close-friends/${friendId}`, token);
    return response?.data;
};

// ─── Generic user search (used for @mentions in stories) ──────────────────
const searchUsers = async (query, token) => {
    const q = encodeURIComponent(String(query || '').trim());
    const response = await get(`mobile/search?type=students&q=${q}`, token);
    return response?.data;
};

// ─── Music browse (story music sticker) ───────────────────────────────────
// GET /mobile/music/browse?section=top_morocco|search|trending|original&country=MA&q=&limit=50
// Returns: { section, title, country, source, items[], total, preview_max_ms, story_max_ms }
const browseMusic = async (token, {
    section = 'top_morocco',
    country = 'MA',
    q = '',
    limit = 50,
} = {}) => {
    const params = new URLSearchParams({
        section: String(section),
        country: String(country),
        limit: String(limit),
    });
    const query = String(q || '').trim();
    if (query) params.set('q', query);
    const response = await get(`mobile/music/browse?${params.toString()}`, token);
    return response?.data;
};

/** @deprecated use browseMusic({ section: 'search', q }) */
const searchMusic = async (query, token, { limit = 50 } = {}) => {
    return browseMusic(token, { section: 'search', q: query, limit });
};

/** @deprecated use browseMusic({ section: 'top_morocco' }) */
const getMusicCharts = async (token, { country = 'MA', limit = 50 } = {}) => {
    return browseMusic(token, { section: 'top_morocco', country, limit });
};

export default {
    get,
    getPublic,
    put,
    post,
    remove,
    getWithAuth,
    postWithAuth,
    APP_URL,
    IMAGE_URL,
    VIDEO_URL,
    listStories,
    createStory,
    viewStory,
    deleteStory,
    getStoryViewers,
    reactToStory,
    removeStoryReaction,
    replyToStory,
    repostStoryFromMention,
    reportStoryCaptureEvent,
    reportStory,
    listStoryArchive,
    reshareStory,
    shareStory,
    interactWithStory,
    getStoryInteractions,
    blockUser,
    listHighlights,
    getHighlight,
    createHighlight,
    addStoryToHighlight,
    removeStoryFromHighlight,
    deleteHighlight,
    updateHighlight,
    listCloseFriends,
    addCloseFriend,
    removeCloseFriend,
    searchUsers,
    browseMusic,
    searchMusic,
    getMusicCharts,
    getEvents,
    getEvent,
    storeEventBooking,
    validateEventInvitation,
    manualEventChecking,
};
