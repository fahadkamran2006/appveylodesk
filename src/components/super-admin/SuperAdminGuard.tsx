import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

const SUPER_ADMIN_EMAILS = ["hello@fahadkamran.com", "m.fahadkamran0001@gmail.com"];

export function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user || !SUPER_ADMIN_EMAILS.includes(user.email || "")) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
