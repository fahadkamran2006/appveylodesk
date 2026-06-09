import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

type UserRole = 'admin' | 'client' | 'editor' | 'staff';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchUserRole = async (userId: string): Promise<UserRole | null> => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return data.role as UserRole;
  };

  const redirectByRole = (role: UserRole | null) => {
    switch (role) {
      case 'admin':
        navigate('/admin/dashboard');
        break;
      case 'client':
        navigate('/client/dashboard');
        break;
      case 'editor':
        navigate('/editor/dashboard');
        break;
      default:
        navigate('/onboarding');
    }
  };

  useEffect(() => {
    const resolveRoleAndMaybeAcceptInvite = async (userId: string, isFromSignUp = false) => {
      // If there's a pending invite token, don't auto-redirect - let onboarding handle it
      const hasPendingInvite = localStorage.getItem('pending_invite_token');
      
      // 1) Try normal role lookup
      let role = await fetchUserRole(userId);

      // 2) If no role yet and NO pending invite, try to accept invitation token
      // (If there IS a pending invite, let the Onboarding page handle it)
      if (!role && !hasPendingInvite) {
        // No role and no pending invite - user needs onboarding
      } else if (!role && hasPendingInvite) {
        // Has pending invite but no role yet - don't try to auto-accept here
        // Let the onboarding page handle the full flow
        setUserRole(null);
        setLoading(false);
        return;
      }

      setUserRole(role);

      // Only auto-redirect when:
      // 1. User has a role
      // 2. No pending invite (invited users should go through onboarding)
      // 3. Currently in auth/onboarding flow
      const path = window.location.pathname;
      // Don't redirect away from join pages - they handle their own flow
      const isJoinPage = path === '/auth/join-client' || path === '/auth/join-team';
      const shouldRedirect =
        !isJoinPage && (path === '/' || path === '/onboarding' || path.startsWith('/auth/'));

      if (role && !hasPendingInvite && shouldRedirect) {
        redirectByRole(role);
      }

      setLoading(false);
    };

    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Defer role fetching with setTimeout to prevent deadlock
        setTimeout(() => {
          resolveRoleAndMaybeAcceptInvite(session.user.id);
        }, 0);
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        resolveRoleAndMaybeAcceptInvite(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    // Check if there's a pending invite token
    const inviteToken = localStorage.getItem('pending_invite_token');
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    if (!error) {
      // After signup, always redirect to onboarding
      // Plan selection is already captured in localStorage from the pricing page
      navigate('/onboarding');
    }

    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.user) {
      const role = await fetchUserRole(data.user.id);
      setUserRole(role);
      redirectByRole(role);
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
