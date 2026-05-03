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
import { XCircle, TrendingDown, MessageSquare, Search, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DateRange } from 'react-day-picker';

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

export default function CancellationsTab() {
  const [logs, setLogs] = useState<CancellationLog[]>([]);
  const [agencies, setAgencies] = useState<Record<string, AgencyLite>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState<RangePreset>('all');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [selected, setSelected] = useState<CancellationLog | null>(null);

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

  // Date-range filtered logs (used by both stats and the table)
  const dateFiltered = useMemo(() => {
    if (preset === 'all') return logs;
    if (preset === 'custom') {
      if (!customRange?.from) return logs;
      const from = customRange.from.getTime();
      const to = (customRange.to ?? customRange.from).getTime() + 24 * 60 * 60 * 1000 - 1;
      return logs.filter((l) => {
        const t = new Date(l.created_at).getTime();
        return t >= from && t <= to;
      });
    }
    const days = parseInt(preset, 10);
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return logs.filter((l) => new Date(l.created_at).getTime() >= cutoff);
  }, [logs, preset, customRange]);

  const stats = useMemo(() => {
    const total = dateFiltered.length;
    const byReason = new Map<string, { code: string; label: string; count: number }>();
    dateFiltered.forEach((l) => {
      const e = byReason.get(l.reason_code) || { code: l.reason_code, label: l.reason_label, count: 0 };
      e.count++;
      byReason.set(l.reason_code, e);
    });
    const reasonRanking = [...byReason.values()].sort((a, b) => b.count - a.count);
    const last30 = dateFiltered.filter(
      (l) => new Date(l.created_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).length;
    const withFeedback = dateFiltered.filter((l) => (l.detail || '').trim().length > 0).length;
    return { total, reasonRanking, last30, withFeedback };
  }, [dateFiltered]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dateFiltered;
    return dateFiltered.filter((l) => {
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
  }, [dateFiltered, search, agencies, profiles]);

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

  const presets: { key: RangePreset; label: string }[] = [
    { key: '7', label: 'Last 7 days' },
    { key: '30', label: 'Last 30 days' },
    { key: '90', label: 'Last 90 days' },
    { key: 'all', label: 'All time' },
  ];

  const selectedAgency = selected ? agencies[selected.agency_id] : null;
  const selectedProfile = selected ? profiles[selected.user_id] : null;

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
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard icon={XCircle} label="Cancellations in range" value={loading ? null : String(stats.total)} />
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
            <p className="text-sm text-muted-foreground p-6 text-center">No cancellations match your filters.</p>
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
