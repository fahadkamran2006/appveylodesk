import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Bug, Lightbulb } from "lucide-react";
import { toast } from "sonner";

interface BugReport {
  id: string;
  user_id: string;
  agency_id: string | null;
  type: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
}

const statusColors: Record<string, string> = {
  open: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  in_progress: "bg-primary/10 text-primary border-primary/30",
  resolved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  closed: "bg-muted text-muted-foreground border-border",
};

const priorityColors: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-amber-400",
  high: "text-orange-400",
  critical: "text-destructive font-bold",
};

export default function BugReportsTab() {
  const queryClient = useQueryClient();

  const { data: reports, isLoading } = useQuery({
    queryKey: ["super-admin-bug-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bug_reports" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as BugReport[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("bug_reports" as any)
        .update({ status, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-bug-reports"] });
      toast.success("Status updated");
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Bug Reports & Suggestions</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" /> Bug Reports & Suggestions
          <Badge variant="secondary" className="ml-auto">{reports?.length ?? 0} total</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!reports?.length ? (
          <p className="text-muted-foreground text-center py-8">No reports yet.</p>
        ) : (
          <div className="space-y-3">
            {reports.map((r) => (
              <div key={r.id} className="flex items-start gap-4 p-4 rounded-lg border border-border/50 bg-card">
                <div className="pt-0.5">
                  {r.type === "bug" ? (
                    <Bug className="w-5 h-5 text-destructive" />
                  ) : (
                    <Lightbulb className="w-5 h-5 text-amber-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm">{r.title}</span>
                    <Badge variant="outline" className={`text-xs capitalize ${statusColors[r.status] || ""}`}>
                      {r.status.replace("_", " ")}
                    </Badge>
                    {r.type === "bug" && (
                      <span className={`text-xs capitalize ${priorityColors[r.priority] || ""}`}>
                        {r.priority}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <Select
                  value={r.status}
                  onValueChange={(val) => updateStatus.mutate({ id: r.id, status: val })}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
