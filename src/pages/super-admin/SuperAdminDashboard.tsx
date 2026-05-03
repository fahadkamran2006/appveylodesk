import { useSuperAdminStats, AgencyStat } from "@/hooks/useSuperAdminStats";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AgencyDrilldownSheet from "@/components/super-admin/AgencyDrilldownSheet";
import BugReportsTab from "@/components/super-admin/BugReportsTab";
import MarketingTab from "@/components/super-admin/MarketingTab";
import CancellationsTab, { type CancellationHighlight } from "@/components/super-admin/CancellationsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign, Building2, HardDrive, TrendingUp, AlertTriangle, Activity,
} from "lucide-react";

function formatBytes(bytes: number) {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`;
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
  return `${bytes} B`;
}

type SortKey = "name" | "revenue" | "client_count" | "editor_count" | "storage_percent";

export default function SuperAdminDashboard() {
  const { data, isLoading, error } = useSuperAdminStats();
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<AgencyStat | null>(null);
  const [highlight, setHighlight] = useState<CancellationHighlight | null>(null);

  const openAgencyFromCancellation = (agencyId: string, h: CancellationHighlight) => {
    const a = data?.agencies.find((x) => x.id === agencyId);
    if (a) {
      setHighlight(h);
      setSelectedAgency(a);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sorted = [...(data?.agencies || [])].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (typeof av === "string") return sortAsc ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string);
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-destructive">
        Failed to load stats: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight">⚡ Veylodesk God Mode</h1>
        <p className="text-sm text-muted-foreground">Platform-wide overview</p>
      </header>

      <main className="p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Big Numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={DollarSign} label="Monthly Recurring Revenue" value={isLoading ? null : `$${data!.total_mrr}`} />
          <StatCard icon={Building2} label="Total Agencies" value={isLoading ? null : String(data!.total_agencies)} />
          <StatCard icon={HardDrive} label="Total Storage Used" value={isLoading ? null : formatBytes(data!.total_storage_used_bytes)} />
          <StatCard icon={TrendingUp} label="Active / Churned" value={isLoading ? null : `${data!.active_agencies} / ${data!.churned_agencies}`} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="agencies">
          <TabsList>
            <TabsTrigger value="agencies">Agency Leaderboard</TabsTrigger>
            <TabsTrigger value="storage">Storage Monitor</TabsTrigger>
            <TabsTrigger value="cancellations">Cancellations</TabsTrigger>
            <TabsTrigger value="bugs">Bug Reports</TabsTrigger>
            <TabsTrigger value="marketing">Marketing</TabsTrigger>
            <TabsTrigger value="logs">System Events</TabsTrigger>
          </TabsList>

          {/* Agencies Table */}
          <TabsContent value="agencies">
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHead active={sortKey === "name"} asc={sortAsc} onClick={() => toggleSort("name")}>Agency</SortableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <SortableHead active={sortKey === "revenue"} asc={sortAsc} onClick={() => toggleSort("revenue")}>Revenue</SortableHead>
                        <SortableHead active={sortKey === "client_count"} asc={sortAsc} onClick={() => toggleSort("client_count")}>Clients</SortableHead>
                        <SortableHead active={sortKey === "editor_count"} asc={sortAsc} onClick={() => toggleSort("editor_count")}>Editors</SortableHead>
                        <SortableHead active={sortKey === "storage_percent"} asc={sortAsc} onClick={() => toggleSort("storage_percent")}>Storage</SortableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.map((a) => (
                        <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedAgency(a)}>
                          <TableCell className="font-medium">{a.name}</TableCell>
                          <TableCell><Badge variant="outline" className="capitalize">{a.plan_tier}</Badge></TableCell>
                          <TableCell>{a.is_active ? <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Active</Badge> : <Badge variant="destructive">Churned</Badge>}</TableCell>
                          <TableCell>${a.revenue}/mo</TableCell>
                          <TableCell>{a.client_count}</TableCell>
                          <TableCell>{a.editor_count}</TableCell>
                          <TableCell className="min-w-[140px]">
                            <div className="flex items-center gap-2">
                              <Progress value={a.storage_percent} className={`h-2 flex-1 ${a.storage_percent >= 90 ? "[&>div]:bg-destructive" : ""}`} />
                              <span className={`text-xs tabular-nums ${a.storage_percent >= 90 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>{a.storage_percent}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {sorted.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No agencies found</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Storage Monitor */}
          <TabsContent value="storage">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Top Storage Users</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
                ) : (
                  [...(data?.agencies || [])].sort((a, b) => b.storage_percent - a.storage_percent).slice(0, 15).map((a) => (
                    <div key={a.id} className="flex items-center gap-3">
                      <span className="w-40 text-sm font-medium truncate">{a.name}</span>
                      <Progress value={a.storage_percent} className={`h-3 flex-1 ${a.storage_percent >= 90 ? "[&>div]:bg-destructive" : ""}`} />
                      <span className={`text-xs w-24 text-right tabular-nums ${a.storage_percent >= 90 ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                        {formatBytes(a.storage_used_bytes)} / {formatBytes(a.storage_limit_bytes)}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cancellations */}
          <TabsContent value="cancellations">
            <CancellationsTab />
          </TabsContent>

          {/* Bug Reports */}
          <TabsContent value="bugs">
            <BugReportsTab />
          </TabsContent>

          {/* Marketing */}
          <TabsContent value="marketing">
            <MarketingTab />
          </TabsContent>

          {/* System Logs */}
          <TabsContent value="logs">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> Recent System Events</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
                ) : (data?.recent_logs?.length || 0) === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No system events yet. Events will appear as users sign up, change subscriptions, etc.</p>
                ) : (
                  <div className="space-y-2">
                    {data!.recent_logs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                        <Badge variant="outline" className="text-xs shrink-0 capitalize">{log.event_type.replace(/_/g, " ")}</Badge>
                        <span className="text-sm flex-1">{log.message}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <AgencyDrilldownSheet
        agency={selectedAgency}
        open={!!selectedAgency}
        onOpenChange={(open) => !open && setSelectedAgency(null)}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            {value === null ? <Skeleton className="h-7 w-20 mt-1" /> : <p className="text-2xl font-bold tracking-tight">{value}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SortableHead({ children, active, asc, onClick }: { children: React.ReactNode; active: boolean; asc: boolean; onClick: () => void }) {
  return (
    <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={onClick}>
      {children} {active ? (asc ? "↑" : "↓") : ""}
    </TableHead>
  );
}
