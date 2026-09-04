import API from '@/api';

/** Resolve chat attachment path to absolute gated or legacy URL. */
export function resolveAttachmentUrl(path) {
    if (!path) return '';
    const base = (API?.APP_URL || '').replace(/\/+$/, '');

    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('file:') || path.startsWith('blob:') || path.startsWith('data:')) {
        return path;
    }

    if (path.startsWith('/api/') || path.startsWith('/chat/') || path.startsWith('/storage/')) {
        return `${base}${path}`;
    }

    return `${base}/storage/${path}`;
}

export function isGatedChatAttachmentUrl(url) {
    return typeof url === 'string' && url.includes('/chat/message/') && url.includes('/attachment');
}
