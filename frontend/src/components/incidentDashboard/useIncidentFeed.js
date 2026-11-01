import { useCallback, useEffect, useState } from 'react';
import { INCIDENTS_CHANGED_EVENT, fetchIncidentFeed } from '../../api';

// How often to re-fetch the feed. Changes in other tabs of this browser arrive instantly.
export const POLL_MS = 5 * 1000;

export default function useIncidentFeed() {
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      setFeed(await fetchIncidentFeed());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setNow(Date.now());
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    window.addEventListener('storage', refresh);
    window.addEventListener(INCIDENTS_CHANGED_EVENT, refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener('storage', refresh);
      window.removeEventListener(INCIDENTS_CHANGED_EVENT, refresh);
    };
  }, [refresh]);

  return { feed, error, now, refresh };
}
