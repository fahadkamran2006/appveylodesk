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
  review_link_id?: string;
  parent_id?: string | null;
  replies?: VideoComment[];
}

export function useVideoComments(deliverableId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!deliverableId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deliverable_comments')
        .select('*')
        .eq('deliverable_id', deliverableId)
        .order('created_at', { ascending: true });

      if (error) throw error;

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
        parent_id: (comment as any).parent_id || null,
      }));

      // Fetch public review comments
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
          is_resolved: (c as any).is_resolved ?? false,
          resolved_by: (c as any).resolved_by ?? null,
          resolved_at: (c as any).resolved_at ?? null,
          created_at: c.created_at,
          updated_at: c.created_at,
          user_name: c.reviewer_name || 'Anonymous',
          source: 'public' as const,
          review_link_id: c.review_link_id,
          parent_id: null,
        }));
      }

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

  const addComment = useCallback(async (
    content: string,
    timestampSeconds: number = 0,
    parentId?: string | null
  ): Promise<VideoComment | null> => {
    if (!user || !deliverableId) return null;

    try {
      const insertData: any = {
        deliverable_id: deliverableId,
        user_id: user.id,
        content,
        timestamp_seconds: timestampSeconds,
      };
      if (parentId) insertData.parent_id = parentId;

      const { data, error } = await supabase
        .from('deliverable_comments')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      const newComment: VideoComment = {
        ...data,
        timestamp_seconds: timestampSeconds,
        user_name: 'You',
        source: 'internal',
        parent_id: (data as any).parent_id || null,
      };

      setComments(prev => [...prev, newComment]);
      toast({ title: 'Feedback added', description: 'Your comment has been saved' });
      return newComment;
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast({ title: 'Failed to add feedback', description: error.message || 'Please try again', variant: 'destructive' });
      return null;
    }
  }, [user, deliverableId, toast]);

  const resolveComment = useCallback(async (commentId: string): Promise<boolean> => {
    if (!user) return false;
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return false;

    try {
      if (comment.source === 'public') {
        const { error } = await supabase
          .from('public_review_comments')
          .update({ is_resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() } as any)
          .eq('id', commentId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('deliverable_comments')
          .update({ is_resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() })
          .eq('id', commentId);
        if (error) throw error;
      }

      setComments(prev => prev.map(c =>
        c.id === commentId
          ? { ...c, is_resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() }
          : c
      ));
      toast({ title: 'Feedback resolved' });
      return true;
    } catch (error: any) {
      console.error('Error resolving comment:', error);
      toast({ title: 'Failed to resolve', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [user, comments, toast]);

  const unresolveComment = useCallback(async (commentId: string): Promise<boolean> => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return false;

    try {
      if (comment.source === 'public') {
        const { error } = await supabase
          .from('public_review_comments')
          .update({ is_resolved: false, resolved_by: null, resolved_at: null } as any)
          .eq('id', commentId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('deliverable_comments')
          .update({ is_resolved: false, resolved_by: null, resolved_at: null })
          .eq('id', commentId);
        if (error) throw error;
      }

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
  }, [comments]);

  const editComment = useCallback(async (commentId: string, newContent: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('deliverable_comments')
        .update({ content: newContent })
        .eq('id', commentId)
        .eq('user_id', user.id);

      if (error) throw error;

      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, content: newContent } : c
      ));
      toast({ title: 'Comment updated' });
      return true;
    } catch (error: any) {
      console.error('Error editing comment:', error);
      toast({ title: 'Failed to edit', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [user, toast]);

  const deleteComment = useCallback(async (commentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('deliverable_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      // Remove comment and its replies
      setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId));
      toast({ title: 'Comment deleted' });
      return true;
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [toast]);

  // Build threaded structure: top-level comments with nested replies
  const topLevelComments = comments.filter(c => !c.parent_id);
  const threadedComments = topLevelComments.map(c => ({
    ...c,
    replies: comments.filter(r => r.parent_id === c.id).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ),
  }));

  const unresolvedComments = threadedComments.filter(c => !c.is_resolved);
  const resolvedComments = threadedComments.filter(c => c.is_resolved);

  useEffect(() => {
    if (!deliverableId) return;
    fetchComments();

    const channel = supabase
      .channel(`comments-${deliverableId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'deliverable_comments',
        filter: `deliverable_id=eq.${deliverableId}`,
      }, () => { fetchComments(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [deliverableId, fetchComments]);

  return {
    comments: threadedComments,
    unresolvedComments,
    resolvedComments,
    loading,
    addComment,
    resolveComment,
    unresolveComment,
    editComment,
    deleteComment,
    refetch: fetchComments,
  };
}
