import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const friendlyError = (code: string | null, description: string | null) => {
  const desc = (description || '').toLowerCase();
  if (desc.includes('confirmation_token') || desc.includes('scan error')) {
    return 'Your account record needs repair on the server. Please contact support.';
  }
  if (code === 'access_denied') return 'Sign-in was cancelled.';
  if (desc.includes('provider')) return 'This sign-in provider is not enabled yet.';
  return description || 'Sign-in failed. Please try again.';
};

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const redirectAfterSession = () => {
      const pendingToken = localStorage.getItem('pending_invite_token');
      if (pendingToken) {
        navigate(`/join-team?token=${pendingToken}`, { replace: true });
      } else {
        // useAuth resolves the role and routes to the right dashboard
        navigate('/', { replace: true });
      }
    };

    const run = async () => {
      // Provider/server errors come back in the hash or the query string
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const query = new URLSearchParams(window.location.search);
      const errCode = hash.get('error') || query.get('error');
      const errDesc =
        hash.get('error_description') || query.get('error_description');

      if (errCode) {
        toast.error(friendlyError(errCode, errDesc));
        navigate('/auth/login', { replace: true });
        return;
      }

      // PKCE flow: exchange the code for a session if the client hasn't already
      const code = query.get('code');
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error && !/code verifier|already/i.test(error.message)) {
          toast.error(friendlyError(null, error.message));
          navigate('/auth/login', { replace: true });
          return;
        }
      }

      // Session hydration can lag slightly behind the redirect
      for (let attempt = 0; attempt < 10; attempt++) {
        if (cancelled) return;
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          redirectAfterSession();
          return;
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      if (!cancelled) {
        toast.error('We could not complete sign-in. Please try again.');
        navigate('/auth/login', { replace: true });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Signing you in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;
