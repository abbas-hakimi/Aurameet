export const validateUsername = (value) => /^[a-z0-9_.]{3,30}$/i.test(value.trim());
export const validatePassword = (value) => typeof value === 'string' && value.length >= 8 && new TextEncoder().encode(value).length <= 72;
export const validateMeetingTitle = (value) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120;
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'A';
export const formatDate = (date) => date ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)) : 'Not scheduled';
