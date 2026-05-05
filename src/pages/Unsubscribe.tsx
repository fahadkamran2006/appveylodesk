import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    (async () => {
      const { error } = await supabase.functions.invoke("lead-magnet-unsubscribe", {
        body: { token },
      });
      setState(error ? "error" : "ok");
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-foreground flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center rounded-2xl border border-white/10 bg-white/[0.03] p-10 space-y-4">
        {state === "loading" && (
          <>
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#4B4BE1]" />
            <p className="text-muted-foreground">Processing your request…</p>
          </>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="w-10 h-10 mx-auto text-[#4B4BE1]" />
            <h1 className="text-xl font-semibold">You're unsubscribed</h1>
            <p className="text-muted-foreground text-sm">
              You won't receive any more emails about the Veylodesk guide. Thanks for
              being here.
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <AlertTriangle className="w-10 h-10 mx-auto text-destructive" />
            <h1 className="text-xl font-semibold">Invalid link</h1>
            <p className="text-muted-foreground text-sm">
              This unsubscribe link is invalid or has expired.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
