import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentUserCoach, type Coach } from '../lib/coachApi';

export function useCurrentCoach(enabled = true) {
  const { loading: authLoading, user, userProfile } = useAuth();
  const academyId = userProfile?.academyId ?? null;
  const [coach, setCoach] = useState<Coach | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const resolveCoach = async () => {
      if (!enabled || authLoading) return;
      if (!user) {
        if (active) {
          setCoach(null);
          setError('You must be signed in to load a coach profile.');
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError('');
      try {
        const resolvedCoach = await getCurrentUserCoach(academyId);
        if (active) setCoach(resolvedCoach);
      } catch (caught) {
        if (active) {
          setCoach(null);
          setError(caught instanceof Error ? caught.message : 'Could not resolve the authenticated coach profile.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    if (!enabled) {
      setCoach(null);
      setError('');
      setLoading(false);
      return () => { active = false; };
    }

    void resolveCoach();
    const refreshAfterClaim = () => void resolveCoach();
    window.addEventListener('coach-account-claimed', refreshAfterClaim);
    window.addEventListener('focus', refreshAfterClaim);
    return () => {
      active = false;
      window.removeEventListener('coach-account-claimed', refreshAfterClaim);
      window.removeEventListener('focus', refreshAfterClaim);
    };
  }, [academyId, authLoading, enabled, user?.id]);

  return { coach, error, loading };
}
