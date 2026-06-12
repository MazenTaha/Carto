export const GUEST_SESSION_COOKIE = 'carto_guest_session';
export const LEGACY_GUEST_SESSION_COOKIES = ['guest_session_id', 'guest_mode', 'carto_guest_id', 'carto_guest_key'] as const;
export const GUEST_SESSION_MAX_AGE = 60 * 60 * 24 * 90;
