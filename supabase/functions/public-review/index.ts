import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { action, token, reviewer_name, content, timestamp_seconds, approval_action } = await req.json();

    if (action === 'get_review') {
      // Fetch review link + deliverable + existing comments (no auth needed)
      const { data: link, error: linkError } = await supabaseAdmin
        .from('public_review_links')
        .select('*, deliverables(id, file_name, file_url, file_type, version, project_id)')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (linkError || !link) {
        return new Response(JSON.stringify({ error: 'Review link not found or expired' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check expiry
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'This review link has expired' }), {
          status: 410,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get comments
      const { data: comments } = await supabaseAdmin
        .from('public_review_comments')
        .select('*')
        .eq('review_link_id', link.id)
        .order('created_at', { ascending: true });

      // Also get internal comments from deliverable_comments
      const { data: internalComments } = await supabaseAdmin
        .from('deliverable_comments')
        .select('*')
        .eq('deliverable_id', link.deliverable_id)
        .order('created_at', { ascending: true });

      // Get user profiles for internal comments
      const userIds = [...new Set(internalComments?.map((c: any) => c.user_id) || [])];
      let profileMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
      }

      // Get project title
      const deliverable = link.deliverables as any;
      let projectTitle = '';
      if (deliverable?.project_id) {
        const { data: project } = await supabaseAdmin
          .from('projects')
          .select('title')
          .eq('id', deliverable.project_id)
          .single();
        projectTitle = project?.title || '';
      }

      // Generate signed URL for the video if it's in Supabase storage
      let signedUrl: string | null = null;
      const fileUrl = deliverable?.file_url || '';
      
      // Check if it's a Bunny Stream video (GUID or embed URL)
      const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isBunnyStream = guidPattern.test(fileUrl) || 
        fileUrl.includes('.b-cdn.net/') || 
        fileUrl.includes('iframe.mediadelivery.net');
      
      if (!isBunnyStream && fileUrl.includes('/deliverables/')) {
        // Extract path and create signed URL
        const idx = fileUrl.indexOf('/deliverables/');
        const path = decodeURIComponent(fileUrl.slice(idx + '/deliverables/'.length).split('?')[0]);
        const { data: signedData } = await supabaseAdmin.storage
          .from('deliverables')
          .createSignedUrl(path, 3600);
        signedUrl = signedData?.signedUrl || null;
      }

      return new Response(JSON.stringify({
        ok: true,
        review_link: {
          id: link.id,
          allow_approval: link.allow_approval,
          expires_at: link.expires_at,
        },
        deliverable: {
          id: deliverable?.id,
          file_name: deliverable?.file_name,
          file_url: signedUrl || fileUrl,
          file_type: deliverable?.file_type,
          version: deliverable?.version,
        },
        project_title: projectTitle,
        comments: (comments || []).map((c: any) => ({
          id: c.id,
          reviewer_name: c.reviewer_name,
          content: c.content,
          timestamp_seconds: Number(c.timestamp_seconds),
          created_at: c.created_at,
          source: 'public',
        })),
        internal_comments: (internalComments || []).map((c: any) => ({
          id: c.id,
          user_name: profileMap[c.user_id]?.full_name || profileMap[c.user_id]?.email || 'Team',
          content: c.content,
          timestamp_seconds: Number(c.timestamp_seconds),
          is_resolved: c.is_resolved,
          created_at: c.created_at,
          source: 'internal',
        })),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'add_comment') {
      // Validate token
      const { data: link } = await supabaseAdmin
        .from('public_review_links')
        .select('id, expires_at, is_active')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (!link) {
        return new Response(JSON.stringify({ error: 'Invalid review link' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'This review link has expired' }), {
          status: 410,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: comment, error } = await supabaseAdmin
        .from('public_review_comments')
        .insert({
          review_link_id: link.id,
          reviewer_name: reviewer_name || 'Anonymous',
          content,
          timestamp_seconds: timestamp_seconds || 0,
        })
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ ok: true, comment }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'approve_video') {
      // Validate token and check allow_approval
      const { data: link } = await supabaseAdmin
        .from('public_review_links')
        .select('id, deliverable_id, allow_approval, expires_at, is_active')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (!link || !link.allow_approval) {
        return new Response(JSON.stringify({ error: 'Not authorized' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'Expired' }), {
          status: 410,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get project from deliverable
      const { data: deliverable } = await supabaseAdmin
        .from('deliverables')
        .select('project_id')
        .eq('id', link.deliverable_id)
        .single();

      if (!deliverable) {
        return new Response(JSON.stringify({ error: 'Deliverable not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newStatus = approval_action === 'approve' ? 'done' : 'in_progress';

      const { error } = await supabaseAdmin
        .from('projects')
        .update({ status: newStatus })
        .eq('id', deliverable.project_id);

      if (error) throw error;

      // Deactivate the link after approval
      if (approval_action === 'approve') {
        await supabaseAdmin
          .from('public_review_links')
          .update({ is_active: false })
          .eq('id', link.id);
      }

      return new Response(JSON.stringify({ ok: true, new_status: newStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('public-review error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
