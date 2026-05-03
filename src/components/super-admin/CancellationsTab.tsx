import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { XCircle, TrendingDown, MessageSquare, Search } from 'lucide-react';

interface CancellationLog {
  id: string;
  agency_id: string;
  user_id: string;
  reason_code: string;
  reason_label: string;
  detail: string | null;
  subscription_ends_at: string | null;
  plan_tier: string | null;
  created_at: string;
}

interface AgencyLite { id: string; name: string }
interface ProfileLite { id: string; full_name: string | null; email: string }

export default function CancellationsTab() {
  const [logs, setLogs] = useState<CancellationLog[]>([]);
  const [agencies, setAgencies] = useState<Record<string, AgencyLite>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('subscription_cancellation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      const rows = (data || []) as CancellationLog[];
      setLogs(rows);

      const agencyIds = [...new Set(rows.map((r) => r.agency_id))];
      const userIds = [...new Set(rows.map((r) => r.user_id))];

      const [agencyRes, profileRes] = await Promise.all([
        agencyIds.length
          ? supabase.from('agencies').select('id, name').in('id', agencyIds)
          : Promise.resolve({ data: [] as AgencyLite[] }),
        userIds.length
          ? supabase.from('profiles').select('id, full_name, email').in('id', userIds)
          : Promise.resolve({ data: [] as ProfileLite[] }),
      ]);

      const aMap: Record<string, AgencyLite> = {};
      (agencyRes.data as AgencyLite[] | null)?.forEach((a) => { aMap[a.id] = a; });
      const pMap: Record<string, ProfileLite> = {};
      (profileRes.data as ProfileLite[] | null)?.forEach((p) => { pMap[p.id] = p; });

      setAgencies(aMap);
      setProfiles(pMap);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const total = logs.length;
    const byReason = new Map<string, { code: string; label: string; count: number }>();
    logs.forEach((l) => {
      const e = byReason.get(l.reason_code) || { code: l.reason_code, label: l.reason_label, count: 0 };
      e.count++;
      byReason.set(l.reason_code, e);
    });
    const reasonRanking = [...byReason.values()].sort((a, b) => b.count - a.count);

    const last30 = logs.filter(
      (l) => new Date(l.created_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).length;

    const withFeedback = logs.filter((l) => (l.detail || '').trim().length > 0).length;

    return { total, reasonRanking, last30, withFeedback };
  }, [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => {
      const a = agencies[l.agency_id]?.name?.toLowerCase() || '';
      const p = profiles[l.user_id];
      const who = `${p?.full_name || ''} ${p?.email || ''}`.toLowerCase();
      return (
        a.includes(q)
        || who.includes(q)
        || l.reason_label.toLowerCase().includes(q)
        || (l.detail || '').toLowerCase().includes(q)
        || (l.plan_tier || '').toLowerCase().includes(q)
      );
    });
  }, [logs, search, agencies, profiles]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-destructive">Failed to load cancellations: {error}</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard icon={XCircle} label="Total cancellations" value={loading ? null : String(stats.total)} />
        <SummaryCard icon={TrendingDown} label="Last 30 days" value={loading ? null : String(stats.last30)} />
        <SummaryCard icon={MessageSquare} label="With written feedback" value={loading ? null : String(stats.withFeedback)} />
      </div>

      {/* Reason breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top reasons</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
          ) : stats.reasonRanking.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cancellation reasons collected yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.reasonRanking.map((r) => {
                const pct = Math.round((r.count / Math.max(stats.total, 1)) * 100);
                return (
                  <div key={r.code} className="flex items-center gap-3">
                    <span className="w-56 text-sm font-medium truncate">{r.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-destructive" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
                      {r.count} · {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">Cancellation log</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search agency, reason, feedback…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No cancellations match your search.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => {
                  const a = agencies[l.agency_id];
                  const p = profiles[l.user_id];
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(l.created_at)}</TableCell>
                      <TableCell className="font-medium">{a?.name || l.agency_id.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm">
                        <div>{p?.full_name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{p?.email || ''}</div>
                      </TableCell>
                      <TableCell>{l.plan_tier ? <Badge variant="outline" className="capitalize">{l.plan_tier}</Badge> : '—'}</TableCell>
                      <TableCell className="text-sm">{l.reason_label}</TableCell>
                      <TableCell className="text-sm max-w-[280px]">
                        {l.detail ? <span className="text-muted-foreground italic">"{l.detail}"</span> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/10"><Icon className="h-5 w-5 text-destructive" /></div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            {value === null ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="text-2xl font-bold tracking-tight">{value}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
