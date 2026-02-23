import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

const SUPER_ADMIN_EMAIL = "hello@fahadkamran.com";

export function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user || user.email !== SUPER_ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
