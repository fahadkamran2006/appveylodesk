import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, MessageSquare, Loader2, ArrowRight, Clock, Filter } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Deliverable } from '@/hooks/useStorage';

interface ReviewItem {
  comment_id: string;
  deliverable_id: string;
  deliverable_name: string;
  version: number | null;
  uploaded_by: string | null;
  uploader_name: string;
  content: string;
  timestamp_seconds: number;
  is_resolved: boolean;
  reviewer_name: string;
  created_at: string;
  source: 'internal' | 'public';
}

interface ProjectReviewQueueProps {
  projectId: string;
  videoDeliverables: Deliverable[];
  onOpenVideo: (deliverable: Deliverable) => void;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function ProjectReviewQueue({ projectId, videoDeliverables, onOpenVideo }: ProjectReviewQueueProps) {
  const { user, userRole } = useAuth();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [editorFilter, setEditorFilter] = useState<string>('all');

  const canResolve = userRole === 'admin' || userRole === 'editor';

  const load = useCallback(async () => {
    if (videoDeliverables.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const ids = videoDeliverables.map(v => v.id);

      const [internalRes, linksRes] = await Promise.all([
        supabase
          .from('deliverable_comments')
          .select('id, deliverable_id, content, timestamp_seconds, is_resolved, created_at, user_id')
          .in('deliverable_id', ids)
          .is('parent_id', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('public_review_links')
          .select('id, deliverable_id')
          .in('deliverable_id', ids),
      ]);

      const internal = internalRes.data || [];
      const links = linksRes.data || [];
      const linkMap = new Map(links.map(l => [l.id, l.deliverable_id]));

      let publicComments: any[] = [];
      if (links.length > 0) {
        const { data } = await supabase
          .from('public_review_comments')
          .select('id, review_link_id, content, timestamp_seconds, is_resolved, created_at, reviewer_name')
          .in('review_link_id', links.map(l => l.id))
          .order('created_at', { ascending: false });
        publicComments = data || [];
      }

      const userIds = [...new Set(internal.map(c => c.user_id).filter(Boolean))];
      const profileMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        (profiles || []).forEach(p => profileMap.set(p.id, p.full_name || p.email || 'Unknown'));
      }

      const delMap = new Map(videoDeliverables.map(d => [d.id, d]));

      const combined: ReviewItem[] = [
        ...internal.map(c => {
          const del = delMap.get(c.deliverable_id);
          return {
            comment_id: c.id,
            deliverable_id: c.deliverable_id,
            deliverable_name: del?.file_name || 'Video',
            version: del?.version ?? null,
            uploaded_by: del?.uploaded_by ?? null,
            uploader_name: del?.uploader_name || 'Unknown',
            content: c.content,
            timestamp_seconds: Number(c.timestamp_seconds),
            is_resolved: c.is_resolved,
            reviewer_name: profileMap.get(c.user_id) || 'Reviewer',
            created_at: c.created_at,
            source: 'internal' as const,
          };
        }),
        ...publicComments.map(c => {
          const delId = linkMap.get(c.review_link_id) || '';
          const del = delMap.get(delId);
          return {
            comment_id: c.id,
            deliverable_id: delId,
            deliverable_name: del?.file_name || 'Video',
            version: del?.version ?? null,
            uploaded_by: del?.uploaded_by ?? null,
            uploader_name: del?.uploader_name || 'Unknown',
            content: c.content,
            timestamp_seconds: Number(c.timestamp_seconds),
            is_resolved: !!c.is_resolved,
            reviewer_name: c.reviewer_name || 'Client',
            created_at: c.created_at,
            source: 'public' as const,
          };
        }),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setItems(combined);
    } catch (e) {
      console.error('Failed to load review queue:', e);
    } finally {
      setLoading(false);
    }
  }, [videoDeliverables]);

  useEffect(() => {
    load();
  }, [load]);

  // Build list of editors who have uploaded any video in this project.
  // Keep hooks before any early returns to avoid React hook-order crashes when
  // the queue changes from loading -> loaded.
  const editorOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach(i => {
      if (i.uploaded_by) map.set(i.uploaded_by, i.uploader_name);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [items]);

  const filteredByEditor = editorFilter === 'all'
    ? items
    : items.filter(i => i.uploaded_by === editorFilter);

  const unresolved = filteredByEditor.filter(i => !i.is_resolved);
  const resolved = filteredByEditor.filter(i => i.is_resolved);
  const visible = showResolved ? filteredByEditor : unresolved;

  // Group by deliverable for cleaner display
  const grouped = visible.reduce<Record<string, ReviewItem[]>>((acc, item) => {
    (acc[item.deliverable_id] ||= []).push(item);
    return acc;
  }, {});

  const handleResolve = async (item: ReviewItem) => {
    if (!user) return;
    setResolvingId(item.comment_id);
    try {
      const payload = { is_resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() };
      const table = item.source === 'public' ? 'public_review_comments' : 'deliverable_comments';
      const { error } = await supabase.from(table).update(payload as any).eq('id', item.comment_id);
      if (error) throw error;
      setItems(prev => prev.map(i => i.comment_id === item.comment_id ? { ...i, is_resolved: true } : i));
    } catch (e) {
      console.error('Resolve failed:', e);
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading review queue…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-sm font-semibold">Review Queue</h4>
          <Badge variant={unresolved.length > 0 ? 'default' : 'secondary'} className="text-xs">
            {unresolved.length} unresolved
          </Badge>
          {resolved.length > 0 && (
            <Badge variant="outline" className="text-xs">{resolved.length} resolved</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {editorOptions.length > 0 && (
            <Select value={editorFilter} onValueChange={setEditorFilter}>
              <SelectTrigger className="h-8 text-xs w-[180px]">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Filter editor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All editors</SelectItem>
                {editorOptions.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant={showResolved ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowResolved(v => !v)}
          >
            {showResolved ? 'Showing all' : 'Unresolved only'}
          </Button>
        </div>
      </div>


      {visible.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground border border-dashed border-border rounded-lg">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
          <p className="text-sm font-medium">All caught up</p>
          <p className="text-xs">No unresolved revisions on this project.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([delId, list]) => {
            const del = videoDeliverables.find(d => d.id === delId);
            return (
              <div key={delId} className="border border-border rounded-lg overflow-hidden bg-card">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{del?.file_name || 'Video'}</p>
                    {del?.version && <p className="text-xs text-muted-foreground">Version {del.version}</p>}
                  </div>
                  {del && (
                    <Button size="sm" variant="outline" onClick={() => onOpenVideo(del)}>
                      Open review <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
                <div className="divide-y divide-border">
                  {list.map(item => (
                    <div key={item.comment_id} className={cn("p-3 flex gap-3", item.is_resolved && "opacity-60")}>
                      <div className="flex-shrink-0">
                        <button
                          onClick={() => del && onOpenVideo(del)}
                          className={cn(
                            "px-2 py-1 rounded text-[11px] font-mono font-medium tabular-nums",
                            item.is_resolved
                              ? "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25"
                              : "bg-amber-400/15 text-amber-600 hover:bg-amber-400/25"
                          )}
                          title="Jump to timestamp"
                        >
                          {formatTime(item.timestamp_seconds)}
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-0.5">
                          <span className="font-medium text-foreground">{item.reviewer_name}</span>
                          <span className="text-[10px]">•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                          </span>
                          {item.source === 'public' && <Badge variant="outline" className="text-[10px] px-1 py-0">client</Badge>}
                        </div>
                        <p className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap">{item.content}</p>
                      </div>
                      {canResolve && !item.is_resolved && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResolve(item)}
                          disabled={resolvingId === item.comment_id}
                          className="flex-shrink-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                        >
                          {resolvingId === item.comment_id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <><CheckCircle2 className="w-4 h-4 mr-1" /> Resolve</>
                          )}
                        </Button>
                      )}
                      {item.is_resolved && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 flex-shrink-0">
                          <CheckCircle2 className="w-4 h-4" /> Resolved
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
