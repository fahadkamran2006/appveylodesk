import { ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface AdminOnlyGuardProps {
  children: ReactNode;
  /** Where unauthenticated visitors are sent. Defaults to /auth/login. */
  loginPath?: string;
}

/**
 * Restricts a route to authenticated users with the `admin` role.
 *
 * - While auth is resolving: shows a centered loader (no content flicker, no
 *   premature data fetches in children).
 * - Unauthenticated: redirects to login with a `from` state so the user can be
 *   sent back after signing in.
 * - Authenticated but not admin (client/editor): renders an inline
 *   "Access restricted" panel and redirects them to their own dashboard, with
 *   a toast explaining why.
 */
export const AdminOnlyGuard = ({ children, loginPath = '/auth/login' }: AdminOnlyGuardProps) => {
  const { user, userRole, loading } = useAuth();
  const location = useLocation();

  // Toast once when a signed-in non-admin lands here.
  useEffect(() => {
    if (!loading && user && userRole && userRole !== 'admin') {
      toast.error('Billing & Subscription is only available to agency admins.');
    }
  }, [loading, user, userRole]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
  }

  if (userRole && userRole !== 'admin') {
    const fallback =
      userRole === 'client'
        ? '/client/dashboard'
        : userRole === 'editor'
          ? '/editor/dashboard'
          : '/';

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-md w-full text-center space-y-4 rounded-2xl border border-border/60 bg-card p-8 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Access restricted</h1>
          <p className="text-sm text-muted-foreground">
            Billing & Subscription is only available to agency admins. Redirecting you back to your
            dashboard…
          </p>
          <Navigate to={fallback} replace />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
