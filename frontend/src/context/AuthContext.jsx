import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { disconnectSocket } from '../api/socket';
import { loginRequest, logoutRequest, meRequest, registerRequest } from '../api/auth.api';
import { session } from '../api/session';
import { refreshAccessToken } from '../api/axios';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(session.getAccessToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => session.subscribe(setAccessToken), []);

  const clearAuth = useCallback(() => {
    session.clear(); disconnectSocket(); setUser(null); setAccessToken(null);
  }, []);
  useEffect(() => { session.setExpiredHandler(clearAuth); return () => session.setExpiredHandler(() => {}); }, [clearAuth]);

  useEffect(() => {
    let active = true;
    const identityVersion = session.getIdentityVersion();
    const initialize = async () => {
      try {
        if (!session.getAccessToken()) await refreshAccessToken(identityVersion);
        if (session.getIdentityVersion() !== identityVersion) return;
        const { data: meData } = await meRequest();
        if (active && session.getIdentityVersion() === identityVersion) {
          setAccessToken(session.getAccessToken());
          setUser(meData.data.user);
        }
      } catch {
        if (active && session.getIdentityVersion() === identityVersion) clearAuth();
      }
      finally { if (active) setLoading(false); }
    };
    initialize();
    return () => { active = false; };
  }, [clearAuth]);

  const acceptAuth = useCallback((data) => {
    session.establishIdentity(data.accessToken, data.user.id || data.user._id);
    setAccessToken(data.accessToken); setUser(data.user);
  }, []);
  const login = useCallback(async (credentials) => {
    const { data } = await loginRequest(credentials); acceptAuth(data.data); return data.data.user;
  }, [acceptAuth]);
  const register = useCallback(async (details) => {
    const { data } = await registerRequest(details); acceptAuth(data.data); return data.data.user;
  }, [acceptAuth]);
  const logout = useCallback(async () => {
    const request = logoutRequest();
    clearAuth();
    await request;
  }, [clearAuth]);

  const value = useMemo(() => ({ user, accessToken, loading, login, register, logout, clearAuth }), [user, accessToken, loading, login, register, logout, clearAuth]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
