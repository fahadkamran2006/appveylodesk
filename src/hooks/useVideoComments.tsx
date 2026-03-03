import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface VideoComment {
  id: string;
  deliverable_id: string;
  user_id: string;
  content: string;
  timestamp_seconds: number;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_avatar?: string;
  source?: 'internal' | 'public';
}

export function useVideoComments(deliverableId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch comments for a deliverable (internal + public)
  const fetchComments = useCallback(async () => {
    if (!deliverableId) return;

    setLoading(true);
    try {
      // Fetch internal comments
      const { data, error } = await supabase
        .from('deliverable_comments')
        .select('*')
        .eq('deliverable_id', deliverableId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get user profiles for internal comments
      const userIds = [...new Set(data?.map(c => c.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const internalComments: VideoComment[] = (data || []).map(comment => ({
        ...comment,
        timestamp_seconds: Number(comment.timestamp_seconds),
        user_name: profileMap.get(comment.user_id)?.full_name || profileMap.get(comment.user_id)?.email || 'Unknown',
        user_avatar: profileMap.get(comment.user_id)?.avatar_url || undefined,
        source: 'internal' as const,
      }));

      // Fetch public review comments via review links for this deliverable
      const { data: reviewLinks } = await supabase
        .from('public_review_links')
        .select('id')
        .eq('deliverable_id', deliverableId);

      let publicComments: VideoComment[] = [];
      if (reviewLinks && reviewLinks.length > 0) {
        const linkIds = reviewLinks.map(l => l.id);
        const { data: pubComments } = await supabase
          .from('public_review_comments')
          .select('*')
          .in('review_link_id', linkIds)
          .order('created_at', { ascending: true });

        publicComments = (pubComments || []).map(c => ({
          id: c.id,
          deliverable_id: deliverableId,
          user_id: '',
          content: c.content,
          timestamp_seconds: Number(c.timestamp_seconds),
          is_resolved: false,
          resolved_by: null,
          resolved_at: null,
          created_at: c.created_at,
          updated_at: c.created_at,
          user_name: c.reviewer_name || 'Anonymous',
          source: 'public' as const,
        }));
      }

      // Merge and sort by created_at
      const allComments = [...internalComments, ...publicComments].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      setComments(allComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [deliverableId]);

  // Add a new comment (no timestamp)
  const addComment = useCallback(async (
    content: string
  ): Promise<VideoComment | null> => {
    if (!user || !deliverableId) return null;

    try {
      const { data, error } = await supabase
        .from('deliverable_comments')
        .insert({
          deliverable_id: deliverableId,
          user_id: user.id,
          content,
          timestamp_seconds: 0,
        })
        .select()
        .single();

      if (error) throw error;

      const newComment: VideoComment = {
        ...data,
        timestamp_seconds: 0,
        user_name: 'You',
        source: 'internal',
      };

      setComments(prev => [...prev, newComment]);

      toast({
        title: 'Feedback added',
        description: 'Your comment has been saved',
      });

      return newComment;
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Failed to add feedback',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
      return null;
    }
  }, [user, deliverableId, toast]);

  // Mark comment as resolved
  const resolveComment = useCallback(async (commentId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('deliverable_comments')
        .update({
          is_resolved: true,
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', commentId);

      if (error) throw error;

      setComments(prev => prev.map(c => 
        c.id === commentId 
          ? { ...c, is_resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() }
          : c
      ));

      toast({
        title: 'Feedback resolved',
        description: 'The feedback has been marked as addressed',
      });

      return true;
    } catch (error: any) {
      console.error('Error resolving comment:', error);
      toast({
        title: 'Failed to resolve',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
      return false;
    }
  }, [user, toast]);

  // Unresolve comment
  const unresolveComment = useCallback(async (commentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('deliverable_comments')
        .update({
          is_resolved: false,
          resolved_by: null,
          resolved_at: null,
        })
        .eq('id', commentId);

      if (error) throw error;

      setComments(prev => prev.map(c => 
        c.id === commentId 
          ? { ...c, is_resolved: false, resolved_by: null, resolved_at: null }
          : c
      ));

      return true;
    } catch (error) {
      console.error('Error unresolving comment:', error);
      return false;
    }
  }, []);

  // Get unresolved comments only
  const unresolvedComments = comments.filter(c => !c.is_resolved);
  const resolvedComments = comments.filter(c => c.is_resolved);

  // Subscribe to realtime changes
  useEffect(() => {
    if (!deliverableId) return;

    fetchComments();

    const channel = supabase
      .channel(`comments-${deliverableId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliverable_comments',
          filter: `deliverable_id=eq.${deliverableId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [deliverableId, fetchComments]);

  return {
    comments,
    unresolvedComments,
    resolvedComments,
    loading,
    addComment,
    resolveComment,
    unresolveComment,
    refetch: fetchComments,
  };
}
