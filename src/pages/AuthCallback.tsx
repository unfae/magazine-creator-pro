import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Password reset links contain #type=recovery in the URL hash.
    // Intercept before getSession() so we don't accidentally send them to /dashboard.
    if (window.location.hash.includes('type=recovery')) {
      navigate('/reset-password', { replace: true });
      return;
    }

    // Everything else (email confirmation, OAuth) — original flow unchanged
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/auth', { replace: true });
      }
    });
  }, [navigate]);

  return <p className="p-8 text-center">Signing you in…</p>;
}