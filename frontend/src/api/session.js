// Access tokens stay in this tab's memory. The HttpOnly refresh cookie is shared
// by every tab for this origin, so test different users in separate profiles.
let accessToken = null;
let identityVersion = 0;
let identityUserId = null;
let expiredHandler = () => {};
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener(accessToken));

export const session = {
  getAccessToken: () => accessToken,
  getIdentityVersion: () => identityVersion,
  setAccessTokenForVersion: (access, version) => {
    if (identityVersion !== version) return false;
    let subject;
    try {
      const payload = access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      subject = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))).sub;
    } catch { return false; }
    if (identityUserId && String(identityUserId) !== String(subject)) return false;
    if (!identityUserId) identityUserId = subject || null;
    accessToken = access;
    notify();
    return true;
  },
  establishIdentity: (access, userId) => { identityVersion += 1; identityUserId = userId == null ? null : String(userId); accessToken = access; notify(); return identityVersion; },
  clear: () => { identityVersion += 1; identityUserId = null; accessToken = null; notify(); },
  subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  setExpiredHandler: (handler) => { expiredHandler = handler; },
  expire: (version = identityVersion) => { if (identityVersion === version) expiredHandler(); },
};
