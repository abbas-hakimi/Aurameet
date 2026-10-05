import axios from 'axios';
import { session } from './session';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api', headers: { 'Content-Type': 'application/json' }, withCredentials: true });
const refreshPromises = new Map();

export const refreshAccessToken = (identityVersion = session.getIdentityVersion()) => {
  if (!refreshPromises.has(identityVersion)) {
    const refreshPromise = api.post('/auth/refresh', {}, { skipAuthRefresh: true }).then(({ data }) => {
      const nextToken = data?.data?.accessToken;
      if (!nextToken) throw new Error('Refresh response did not include an access token');
      if (!session.setAccessTokenForVersion(nextToken, identityVersion)) throw new Error('The signed-in account changed during refresh');
      return nextToken;
    }).finally(() => { refreshPromises.delete(identityVersion); });
    refreshPromises.set(identityVersion, refreshPromise);
  }
  return refreshPromises.get(identityVersion);
};

api.interceptors.request.use((config) => {
  const token = session.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    config._authIdentityVersion = session.getIdentityVersion();
  }
  return config;
});

api.interceptors.response.use((response) => response, async (error) => {
  const config = error.config;
  const authUrl = config?.url?.includes('/auth/login') || config?.url?.includes('/auth/register') || config?.url?.includes('/auth/refresh');
  if (error.response?.status !== 401 || !config || config._retried || config.skipAuthRefresh || authUrl) return Promise.reject(error);
  const requestIdentityVersion = config._authIdentityVersion;
  const currentIdentityVersion = session.getIdentityVersion();
  if (requestIdentityVersion !== undefined && requestIdentityVersion !== currentIdentityVersion) return Promise.reject(error);
  config._retried = true;
  try {
    const nextToken = await refreshAccessToken(currentIdentityVersion);
    if (session.getIdentityVersion() !== currentIdentityVersion) return Promise.reject(error);
    config.headers.Authorization = `Bearer ${nextToken}`;
    return api(config);
  } catch (refreshError) {
    session.expire(currentIdentityVersion);
    return Promise.reject(refreshError);
  }
});

export const apiErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error?.response) return 'Unable to reach AuraMeet. Check your connection and try again.';
  const status = error.response.status;
  if (status === 400) return error.response.data?.message || 'Please check the information and try again.';
  if (status === 401) return error.response.data?.message || 'Your session expired. Please sign in again.';
  if (status === 403) return error.response.data?.message || 'You do not have permission to do that.';
  if (status === 404) return error.response.data?.message || 'We could not find that meeting.';
  if (status === 409) return error.response.data?.message || 'That action conflicts with the current meeting state.';
  if (status >= 500) return 'AuraMeet ran into a server issue. Please try again shortly.';
  return error.response.data?.message || fallback;
};

export default api;
