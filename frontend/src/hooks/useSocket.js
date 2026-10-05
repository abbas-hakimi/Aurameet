import { useEffect, useState } from 'react';
import { getSocket } from '../api/socket';
import useAuth from './useAuth';

export default function useSocket() {
  const { accessToken, user } = useAuth();
  const [socket, setSocket] = useState(null);
  useEffect(() => {
    if (!accessToken || !user) { setSocket(null); return undefined; }
    const shared = getSocket();
    setSocket(shared);
    if (!shared.connected && !shared.active) shared.connect();
    return undefined;
  }, [accessToken, user]);
  return socket;
}
