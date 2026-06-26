import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, CheckCircle2, XCircle, Eye, Clock, User } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ReviewEvent {
  id: string;
  type: 'comment' | 'approved' | 'revision_requested';
  reviewer_name: string;
  content?: string;
  timestamp_seconds?: number;
  created_at: string;
  deliverable_name?: string;
}

interface ReviewActivityTabProps {
  projectId: string;
  onCheckDeliverables?: () => void;
}

export function ReviewActivityTab({ projectId, onCheckDeliverables }: ReviewActivityTabProps) {

  const [events, setEvents] = useState<ReviewEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      // Get all deliverables for this project
      const { data: deliverables } = await supabase
        .from('deliverables')
        .select('id, file_name')
        .eq('project_id', projectId);

      if (!deliverables || deliverables.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      const deliverableIds = deliverables.map(d => d.id);
      const deliverableMap = new Map(deliverables.map(d => [d.id, d.file_name]));

      // Get review links for these deliverables
      const { data: reviewLinks } = await supabase
        .from('public_review_links')
        .select('id, deliverable_id')
        .in('deliverable_id', deliverableIds);

      if (!reviewLinks || reviewLinks.length === 0) {
        setEvents([]);
        setLoading(false);
        return;
      }

      const linkIds = reviewLinks.map(l => l.id);
      const linkToDeliverable = new Map(reviewLinks.map(l => [l.id, l.deliverable_id]));

      // Get public review comments
      const { data: comments } = await supabase
        .from('public_review_comments')
        .select('*')
        .in('review_link_id', linkIds)
        .order('created_at', { ascending: false });

      const allEvents: ReviewEvent[] = (comments || []).map(c => {
        const deliverableId = linkToDeliverable.get(c.review_link_id);
        return {
          id: c.id,
          type: 'comment' as const,
          reviewer_name: c.reviewer_name || 'Anonymous',
          content: c.content,
          timestamp_seconds: Number(c.timestamp_seconds),
          created_at: c.created_at,
          deliverable_name: deliverableId ? deliverableMap.get(deliverableId) : undefined,
        };
      });

      // Sort by date descending
      allEvents.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setEvents(allEvents);
    } catch (err) {
      console.error('Error fetching review activity:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'comment': return <MessageSquare className="w-4 h-4" />;
      case 'approved': return <CheckCircle2 className="w-4 h-4" />;
      case 'revision_requested': return <XCircle className="w-4 h-4" />;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'comment': return 'text-primary bg-primary/10 border-primary/20';
      case 'approved': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'revision_requested': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      default: return 'text-muted-foreground bg-muted border-border';
    }
  };

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'comment': return 'Comment';
      case 'approved': return 'Approved';
      case 'revision_requested': return 'Revision';
      default: return 'Event';
    }
  };

  const formatTimestamp = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 bg-muted rounded" />
              <div className="h-4 w-full bg-muted/60 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center mb-4">
          <Eye className="w-7 h-7 text-primary/70" />
        </div>
        <p className="text-base font-semibold text-foreground mb-1.5">No review activity yet</p>
        <p className="text-sm text-muted-foreground max-w-[320px] mb-5 leading-relaxed">
          Once you share a review link, this timeline will fill up with every action reviewers take.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-w-md w-full mb-5">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border/60 text-xs text-muted-foreground">
            <MessageSquare className="w-3.5 h-3.5 text-primary/70" />
            <span>New comment</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border/60 text-xs text-muted-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Approved</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/40 border border-border/60 text-xs text-muted-foreground">
            <XCircle className="w-3.5 h-3.5 text-amber-500" />
            <span>Revision</span>
          </div>
        </div>
        {onCheckDeliverables && (
          <button
            onClick={onCheckDeliverables}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 hover:underline underline-offset-4"
          >
            Check delivered files →
          </button>
        )}
      </div>
    );
  }


  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-1">
        <AnimatePresence initial={false}>
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
              className="flex gap-3 py-3 relative"
            >
              {/* Timeline line */}
              {index < events.length - 1 && (
                <div className="absolute left-4 top-11 bottom-0 w-px bg-border" />
              )}

              {/* Icon */}
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border',
                getEventColor(event.type)
              )}>
                {getEventIcon(event.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <User className="w-3 h-3 text-muted-foreground" />
                    {event.reviewer_name}
                  </span>
                  <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', getEventColor(event.type))}>
                    {getEventLabel(event.type)}
                  </Badge>
                  {event.deliverable_name && (
                    <span className="text-xs text-muted-foreground truncate">
                      on {event.deliverable_name}
                    </span>
                  )}
                </div>

                {event.content && (
                  <p className="text-sm text-foreground/80 mt-1 leading-relaxed">
                    {event.content}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </span>
                  {event.timestamp_seconds != null && event.timestamp_seconds > 0 && (
                    <span className="text-[11px] text-primary font-mono">
                      @ {formatTimestamp(event.timestamp_seconds)}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}
