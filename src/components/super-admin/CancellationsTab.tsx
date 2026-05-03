import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { XCircle, TrendingDown, MessageSquare, Search, CalendarIcon, Download, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';
import { toast } from 'sonner';

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

type RangePreset = '7' | '30' | '90' | 'all' | 'custom';
type SortKey = 'created_at' | 'reason_label' | 'plan_tier';

const PAGE_SIZE = 50;

interface CancellationHighlight {
  cancellationId: string;
  reasonLabel: string;
  detail: string | null;
  createdAt: string;
}

interface CancellationsTabProps {
  onOpenAgency?: (agencyId: string, highlight: CancellationHighlight) => void;
}

export default function CancellationsTab({ onOpenAgency }: CancellationsTabProps = {}) {
  const [logs, setLogs] = useState<CancellationLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [agencies, setAgencies] = useState<Record<string, AgencyLite>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState<RangePreset>('all');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [selected, setSelected] = useState<CancellationLog | null>(null);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [exporting, setExporting] = useState(false);
  const [reasonFilter, setReasonFilter] = useState<string[]>([]);

  // Aggregate stats (independent of pagination, scoped to date range)
  const [stats, setStats] = useState<{
    total: number;
    last30: number;
    withFeedback: number;
    reasonRanking: { code: string; label: string; count: number }[];
  } | null>(null);

  const dateBounds = useMemo(() => {
    if (preset === 'all') return null;
    if (preset === 'custom') {
      if (!customRange?.from) return null;
      const from = new Date(customRange.from); from.setHours(0, 0, 0, 0);
      const to = new Date(customRange.to ?? customRange.from); to.setHours(23, 59, 59, 999);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    const days = parseInt(preset, 10);
    return { from: new Date(Date.now() - days * 86400000).toISOString(), to: null as string | null };
  }, [preset, customRange]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [preset, customRange, search, sortKey, sortDir, reasonFilter]);

  const buildQuery = () => {
    let q = supabase.from('subscription_cancellation_logs').select('*', { count: 'exact' });
    if (dateBounds?.from) q = q.gte('created_at', dateBounds.from);
    if (dateBounds?.to) q = q.lte('created_at', dateBounds.to);
    if (reasonFilter.length > 0) q = q.in('reason_code', reasonFilter);
    const term = search.trim();
    if (term) {
      const safe = term.replace(/[%,()]/g, '');
      q = q.or(`reason_label.ilike.%${safe}%,detail.ilike.%${safe}%,plan_tier.ilike.%${safe}%`);
    }
    return q.order(sortKey, { ascending: sortDir === 'asc' });
  };

  // Fetch the current page
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error: err, count } = await buildQuery().range(from, to);

      if (cancelled) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      const rows = (data || []) as CancellationLog[];
      setLogs(rows);
      setTotalCount(count ?? 0);

      // Lookup agencies/profiles for visible rows (merge into cached maps)
      const newAgencyIds = [...new Set(rows.map((r) => r.agency_id))].filter((id) => !agencies[id]);
      const newUserIds = [...new Set(rows.map((r) => r.user_id))].filter((id) => !profiles[id]);
      const [aRes, pRes] = await Promise.all([
        newAgencyIds.length
          ? supabase.from('agencies').select('id, name').in('id', newAgencyIds)
          : Promise.resolve({ data: [] as AgencyLite[] }),
        newUserIds.length
          ? supabase.from('profiles').select('id, full_name, email').in('id', newUserIds)
          : Promise.resolve({ data: [] as ProfileLite[] }),
      ]);
      if (cancelled) return;
      if (aRes.data?.length) {
        setAgencies((prev) => {
          const next = { ...prev };
          (aRes.data as AgencyLite[]).forEach((a) => { next[a.id] = a; });
          return next;
        });
      }
      if (pRes.data?.length) {
        setProfiles((prev) => {
          const next = { ...prev };
          (pRes.data as ProfileLite[]).forEach((p) => { next[p.id] = p; });
          return next;
        });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortKey, sortDir, dateBounds?.from, dateBounds?.to, search, reasonFilter]);

  // Fetch stats for current date range (paginated through to handle >1k)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all: Pick<CancellationLog, 'reason_code' | 'reason_label' | 'detail' | 'created_at'>[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        let q = supabase
          .from('subscription_cancellation_logs')
          .select('reason_code, reason_label, detail, created_at')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1);
        if (dateBounds?.from) q = q.gte('created_at', dateBounds.from);
        if (dateBounds?.to) q = q.lte('created_at', dateBounds.to);
        const { data, error: err } = await q;
        if (err || !data) break;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
        if (from > 50000) break; // safety cap
      }
      if (cancelled) return;
      const byReason = new Map<string, { code: string; label: string; count: number }>();
      all.forEach((l) => {
        const e = byReason.get(l.reason_code) || { code: l.reason_code, label: l.reason_label, count: 0 };
        e.count++;
        byReason.set(l.reason_code, e);
      });
      const last30Cutoff = Date.now() - 30 * 86400000;
      setStats({
        total: all.length,
        last30: all.filter((l) => new Date(l.created_at).getTime() > last30Cutoff).length,
        withFeedback: all.filter((l) => (l.detail || '').trim().length > 0).length,
        reasonRanking: [...byReason.values()].sort((a, b) => b.count - a.count),
      });
    })();
    return () => { cancelled = true; };
  }, [dateBounds?.from, dateBounds?.to]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <button
      type="button"
      onClick={() => toggleSort(k)}
      className="inline-flex items-center gap-1 hover:text-foreground"
    >
      {label}
      {sortKey === k && (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
    </button>
  );

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      // Fetch all matching rows (respecting filters/sort) in pages
      const all: CancellationLog[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error: err } = await buildQuery().range(from, from + PAGE - 1);
        if (err) throw err;
        const rows = (data || []) as CancellationLog[];
        all.push(...rows);
        if (rows.length < PAGE) break;
        from += PAGE;
        if (from > 50000) break;
      }

      // Hydrate any missing agencies/profiles
      const missingAgencies = [...new Set(all.map((r) => r.agency_id))].filter((id) => !agencies[id]);
      const missingUsers = [...new Set(all.map((r) => r.user_id))].filter((id) => !profiles[id]);
      const [aRes, pRes] = await Promise.all([
        missingAgencies.length
          ? supabase.from('agencies').select('id, name').in('id', missingAgencies)
          : Promise.resolve({ data: [] as AgencyLite[] }),
        missingUsers.length
          ? supabase.from('profiles').select('id, full_name, email').in('id', missingUsers)
          : Promise.resolve({ data: [] as ProfileLite[] }),
      ]);
      const aMap = { ...agencies };
      (aRes.data as AgencyLite[] | null)?.forEach((a) => { aMap[a.id] = a; });
      const pMap = { ...profiles };
      (pRes.data as ProfileLite[] | null)?.forEach((p) => { pMap[p.id] = p; });

      const headers = [
        'Created at', 'Agency', 'Agency ID', 'User name', 'User email', 'User ID',
        'Plan', 'Reason', 'Reason code', 'Feedback', 'Subscription ends at',
      ];
      const escape = (v: unknown) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [headers.join(',')];
      all.forEach((l) => {
        const a = aMap[l.agency_id];
        const p = pMap[l.user_id];
        lines.push([
          new Date(l.created_at).toISOString(),
          a?.name || '',
          l.agency_id,
          p?.full_name || '',
          p?.email || '',
          l.user_id,
          l.plan_tier || '',
          l.reason_label,
          l.reason_code,
          l.detail || '',
          l.subscription_ends_at || '',
        ].map(escape).join(','));
      });

      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cancellations-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${all.length} cancellation${all.length === 1 ? '' : 's'}`);
    } catch (e) {
      toast.error(`Export failed: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-destructive">Failed to load cancellations: {error}</CardContent>
      </Card>
    );
  }

  const presets: { key: RangePreset; label: string }[] = [
    { key: '7', label: 'Last 7 days' },
    { key: '30', label: 'Last 30 days' },
    { key: '90', label: 'Last 90 days' },
    { key: 'all', label: 'All time' },
  ];

  const selectedAgency = selected ? agencies[selected.agency_id] : null;
  const selectedProfile = selected ? profiles[selected.user_id] : null;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Date range filters */}
      <div className="flex flex-wrap items-center gap-2">
        {presets.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={preset === p.key ? 'default' : 'outline'}
            onClick={() => { setPreset(p.key); setCustomRange(undefined); }}
          >
            {p.label}
          </Button>
        ))}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant={preset === 'custom' ? 'default' : 'outline'}
              className={cn('gap-2', preset === 'custom' && 'ring-1 ring-ring')}
            >
              <CalendarIcon className="w-4 h-4" />
              {preset === 'custom' && customRange?.from
                ? `${format(customRange.from, 'MMM d')}${customRange.to ? ` – ${format(customRange.to, 'MMM d')}` : ''}`
                : 'Custom range'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={customRange}
              onSelect={(r) => { setCustomRange(r); if (r?.from) setPreset('custom'); }}
              numberOfMonths={2}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
        {preset === 'custom' && (
          <Button size="sm" variant="ghost" onClick={() => { setPreset('all'); setCustomRange(undefined); }}>
            Clear
          </Button>
        )}
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={handleExportCsv} disabled={exporting} className="gap-2">
          <Download className="w-4 h-4" />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard icon={XCircle} label="Cancellations in range" value={stats ? String(stats.total) : null} />
        <SummaryCard icon={TrendingDown} label="Last 30 days" value={stats ? String(stats.last30) : null} />
        <SummaryCard icon={MessageSquare} label="With written feedback" value={stats ? String(stats.withFeedback) : null} />
      </div>

      {/* Reason breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top reasons</CardTitle>
        </CardHeader>
        <CardContent>
          {!stats ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
          ) : stats.reasonRanking.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cancellation reasons collected in this range.</p>
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
              placeholder="Search reason, feedback, plan…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6 text-center">No cancellations match your filters.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortHeader label="When" k="created_at" /></TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead><SortHeader label="Plan" k="plan_tier" /></TableHead>
                  <TableHead><SortHeader label="Reason" k="reason_label" /></TableHead>
                  <TableHead>Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => {
                  const a = agencies[l.agency_id];
                  const p = profiles[l.user_id];
                  return (
                    <TableRow
                      key={l.id}
                      onClick={() => setSelected(l)}
                      className="cursor-pointer hover:bg-muted/50"
                    >
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(l.created_at)}</TableCell>
                      <TableCell className="font-medium">{a?.name || l.agency_id.slice(0, 8)}</TableCell>
                      <TableCell className="text-sm">
                        <div>{p?.full_name || '—'}</div>
                        <div className="text-xs text-muted-foreground">{p?.email || ''}</div>
                      </TableCell>
                      <TableCell>{l.plan_tier ? <Badge variant="outline" className="capitalize">{l.plan_tier}</Badge> : '—'}</TableCell>
                      <TableCell className="text-sm">{l.reason_label}</TableCell>
                      <TableCell className="text-sm max-w-[280px] truncate">
                        {l.detail ? <span className="text-muted-foreground italic">"{l.detail}"</span> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination footer */}
          {totalCount > 0 && (
            <div className="flex items-center justify-between p-4 border-t text-sm text-muted-foreground">
              <span>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm" variant="outline"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0 || loading}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="tabular-nums">Page {page + 1} of {totalPages}</span>
                <Button
                  size="sm" variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1 || loading}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drilldown side panel */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Cancellation detail</SheetTitle>
                <SheetDescription>{fmtDate(selected.created_at)}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <DetailRow label="Agency" value={selectedAgency?.name || selected.agency_id} mono={!selectedAgency} />
                <DetailRow label="Agency ID" value={selected.agency_id} mono />
                <DetailRow
                  label="User"
                  value={
                    <div>
                      <div>{selectedProfile?.full_name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{selectedProfile?.email || selected.user_id}</div>
                    </div>
                  }
                />
                <DetailRow
                  label="Plan"
                  value={selected.plan_tier ? <Badge variant="outline" className="capitalize">{selected.plan_tier}</Badge> : '—'}
                />
                <DetailRow label="Reason" value={selected.reason_label} />
                <DetailRow label="Reason code" value={selected.reason_code} mono />
                {selected.subscription_ends_at && (
                  <DetailRow label="Subscription ends" value={fmtDate(selected.subscription_ends_at)} />
                )}
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Written feedback</p>
                  {selected.detail ? (
                    <p className="text-sm whitespace-pre-wrap rounded-md bg-muted p-3 italic">"{selected.detail}"</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No additional feedback provided.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <div className={cn('text-sm', mono && 'font-mono text-xs break-all')}>{value}</div>
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
