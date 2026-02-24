import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, FolderKanban, DollarSign, HardDrive } from "lucide-react";
import type { AgencyStat } from "@/hooks/useSuperAdminStats";

function formatBytes(bytes: number) {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

interface AgencyDrilldownSheetProps {
  agency: AgencyStat | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DrilldownData {
  agency: Record<string, unknown>;
  members: Array<{
    user_id: string;
    role: string;
    created_at: string;
    email?: string;
    full_name?: string;
  }>;
  projects: Array<{
    id: string;
    title: string;
    status: string;
    client_id: string | null;
    due_date: string | null;
    budget: number | null;
    created_at: string;
    completed_at: string | null;
    storage_bytes: number;
  }>;
  invoices_summary: {
    total_invoiced: number;
    total_paid: number;
    count: number;
  };
}

const statusColors: Record<string, string> = {
  backlog: "bg-muted text-muted-foreground",
  in_progress: "bg-blue-500/10 text-blue-600 border-blue-200",
  review: "bg-amber-500/10 text-amber-600 border-amber-200",
  done: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  proposal: "bg-purple-500/10 text-purple-600 border-purple-200",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  request: "bg-indigo-500/10 text-indigo-600 border-indigo-200",
};

export default function AgencyDrilldownSheet({ agency, open, onOpenChange }: AgencyDrilldownSheetProps) {
  const { data, isLoading } = useQuery<DrilldownData>({
    queryKey: ["super-admin-drilldown", agency?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("super-admin-stats", {
        body: null,
        headers: {},
      });
      // We need to pass query params - use fetch directly
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/super-admin-stats?agency_id=${agency?.id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) throw new Error("Failed to fetch agency details");
      return res.json();
    },
    enabled: open && !!agency?.id,
  });

  const clients = (data?.members || []).filter((m) => m.role === "client");
  const editors = (data?.members || []).filter((m) => m.role === "editor");
  const admins = (data?.members || []).filter((m) => m.role === "admin");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[640px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {agency?.name}
            {agency && (
              <Badge variant="outline" className="capitalize ml-2">
                {agency.plan_tier}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            {agency?.is_active ? "Active" : "Churned"} · Created{" "}
            {agency?.created_at ? new Date(agency.created_at).toLocaleDateString() : "—"}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 mt-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-6 mt-6">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <MiniCard icon={Users} label="Members" value={`${clients.length}C · ${editors.length}E · ${admins.length}A`} />
              <MiniCard icon={FolderKanban} label="Projects" value={String(data?.projects?.length || 0)} />
              <MiniCard icon={DollarSign} label="Invoiced / Paid" value={`$${data?.invoices_summary?.total_invoiced || 0} / $${data?.invoices_summary?.total_paid || 0}`} />
              <MiniCard
                icon={HardDrive}
                label="Storage"
                value={`${formatBytes(agency?.storage_used_bytes || 0)} / ${formatBytes(agency?.storage_limit_bytes || 0)}`}
              />
            </div>

            {/* Storage bar */}
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Storage Usage</span>
                <span className={agency && agency.storage_percent >= 90 ? "text-destructive font-bold" : ""}>
                  {agency?.storage_percent}%
                </span>
              </div>
              <Progress
                value={agency?.storage_percent || 0}
                className={`h-3 ${agency && agency.storage_percent >= 90 ? "[&>div]:bg-destructive" : ""}`}
              />
            </div>

            {/* Tabs */}
            <Tabs defaultValue="projects">
              <TabsList className="w-full">
                <TabsTrigger value="projects" className="flex-1">Projects</TabsTrigger>
                <TabsTrigger value="members" className="flex-1">Members</TabsTrigger>
                <TabsTrigger value="storage" className="flex-1">Storage</TabsTrigger>
              </TabsList>

              <TabsContent value="projects" className="mt-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Storage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.projects || []).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium max-w-[180px] truncate">{p.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`capitalize text-xs ${statusColors[p.status] || ""}`}>
                            {p.status.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">{p.budget ? `$${p.budget}` : "—"}</TableCell>
                        <TableCell className="tabular-nums text-xs">{formatBytes(p.storage_bytes)}</TableCell>
                      </TableRow>
                    ))}
                    {(data?.projects || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No projects</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="members" className="mt-3">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.members || []).map((m) => (
                      <TableRow key={m.user_id}>
                        <TableCell className="font-medium">{m.full_name || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{m.email || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">{m.role}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{new Date(m.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                    {(data?.members || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-6">No members</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="storage" className="mt-3 space-y-2">
                {(data?.projects || [])
                  .filter((p) => p.storage_bytes > 0)
                  .sort((a, b) => b.storage_bytes - a.storage_bytes)
                  .slice(0, 15)
                  .map((p) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <span className="w-36 text-sm font-medium truncate">{p.title}</span>
                      <Progress
                        value={agency?.storage_used_bytes ? (p.storage_bytes / agency.storage_used_bytes) * 100 : 0}
                        className="h-2 flex-1"
                      />
                      <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">
                        {formatBytes(p.storage_bytes)}
                      </span>
                    </div>
                  ))}
                {(data?.projects || []).filter((p) => p.storage_bytes > 0).length === 0 && (
                  <p className="text-center text-muted-foreground py-6">No storage data</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MiniCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
          <p className="text-sm font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
