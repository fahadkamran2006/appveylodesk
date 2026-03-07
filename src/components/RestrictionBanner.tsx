import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { AlertTriangle, Ban, Eye } from "lucide-react";

interface Restriction {
  id: string;
  restriction_type: string;
  message: string;
  expires_at: string | null;
}

export function RestrictionBanner() {
  const { profile } = useProfile();
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);

  useEffect(() => {
    if (!profile?.agency_id) return;
    
    supabase
      .from("agency_restrictions" as any)
      .select("id, restriction_type, message, expires_at")
      .eq("agency_id", profile.agency_id)
      .eq("is_active", true)
      .then(({ data }) => {
        if (data) {
          // Filter out expired restrictions
          const active = (data as unknown as Restriction[]).filter(
            (r) => !r.expires_at || new Date(r.expires_at) > new Date()
          );
          setRestrictions(active);
        }
      });
  }, [profile?.agency_id]);

  if (restrictions.length === 0) return null;

  const blocked = restrictions.find((r) => r.restriction_type === "blocked");
  const readOnly = restrictions.find((r) => r.restriction_type === "read_only");
  const warning = restrictions.find((r) => r.restriction_type === "warning");

  const primary = blocked || readOnly || warning;
  if (!primary) return null;

  const config = {
    blocked: {
      icon: Ban,
      bg: "bg-destructive/10 border-destructive/30",
      text: "text-destructive",
    },
    read_only: {
      icon: Eye,
      bg: "bg-orange-500/10 border-orange-500/30",
      text: "text-orange-600",
    },
    warning: {
      icon: AlertTriangle,
      bg: "bg-amber-500/10 border-amber-500/30",
      text: "text-amber-600",
    },
  }[primary.restriction_type] || { icon: AlertTriangle, bg: "bg-muted", text: "text-foreground" };

  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border mb-4 ${config.bg}`}>
      <Icon className={`h-5 w-5 shrink-0 ${config.text}`} />
      <div className="flex-1">
        <p className={`text-sm font-medium ${config.text}`}>
          {primary.restriction_type === "blocked" && "Account Suspended"}
          {primary.restriction_type === "read_only" && "Account in Read-Only Mode"}
          {primary.restriction_type === "warning" && "Account Warning"}
        </p>
        <p className="text-xs text-muted-foreground">{primary.message}</p>
        {primary.expires_at && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Expires: {new Date(primary.expires_at).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
