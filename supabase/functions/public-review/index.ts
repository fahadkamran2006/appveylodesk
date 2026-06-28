import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function notifyAdmins(supabaseAdmin: any, agencyId: string, title: string, message: string, link: string, metadata: Record<string, unknown> = {}) {
  // Get all admins in the agency
  const { data: admins } = await supabaseAdmin
    .from('user_roles')
    .select('user_id')
    .eq('agency_id', agencyId)
    .eq('role', 'admin');

  if (!admins?.length) return;

  for (const admin of admins) {
    // Create in-app notification
    await supabaseAdmin.rpc('create_notification', {
      _user_id: admin.user_id,
      _agency_id: agencyId,
      _type: 'comment_added',
      _title: title,
      _message: message,
      _link: link,
      _metadata: metadata,
    });

    // Send email notification (respects user preferences)
    try {
      await supabaseAdmin.functions.invoke('send-notification-email', {
        body: {
          user_id: admin.user_id,
          agency_id: agencyId,
          type: 'comment_added',
          title,
          message,
          link,
          metadata,
        },
      });
    } catch (e) {
      console.error('Email notification failed:', e);
    }
  }
}

const BUNNY_STREAM_LIBRARY_ID = Deno.env.get('BUNNY_STREAM_LIBRARY_ID') || '';
const BUNNY_STREAM_STORAGE_KEY = Deno.env.get('BUNNY_STREAM_STORAGE_KEY') || '';
const BUNNY_STREAM_API_KEY = Deno.env.get('BUNNY_STREAM_API_KEY') || '';
const BUNNY_STORAGE_HOSTNAME = Deno.env.get('BUNNY_STORAGE_HOSTNAME') || 'storage.bunnycdn.com';
const BUNNY_STORAGE_ZONE = Deno.env.get('BUNNY_STORAGE_ZONE') || '';
const BUNNY_API_KEY = Deno.env.get('BUNNY_API_KEY') || '';

function extractStreamVideoId(url: string): string | null {
  const guidRe = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
  const m = url.match(guidRe);
  return m ? m[1] : null;
}

function sanitizeDownloadName(name: string, ext: string): string {
  let safe = (name || 'file').replace(/[/\\:*?"<>|]/g, '_');
  if (!safe.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) {
    safe = safe.replace(/\.[^.]+$/, '') + `.${ext}`;
  }
  return safe;
}

async function proxyDownload(deliverable: any): Promise<Response> {
  const fileUrl: string = deliverable.file_url || '';
  const fileName: string = deliverable.file_name || 'file';

  // Bunny Stream video — fetch via Storage API
  const isStream =
    /vz-[a-z0-9]+\.b-cdn\.net.*\/playlist\.m3u8/i.test(fileUrl) ||
    fileUrl.includes('iframe.mediadelivery.net') ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileUrl);

  if (isStream) {
    const videoId = extractStreamVideoId(fileUrl);
    if (!videoId || !BUNNY_STREAM_STORAGE_KEY || !BUNNY_STREAM_LIBRARY_ID) {
      return new Response(JSON.stringify({ error: 'Stream download not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const libShort = `vz-${BUNNY_STREAM_LIBRARY_ID.slice(0, 8)}`;
    const urls = [
      `https://storage.bunnycdn.com/${libShort}/${videoId}/original`,
      `https://storage.bunnycdn.com/${libShort}/${videoId}/play_1080p.mp4`,
      `https://storage.bunnycdn.com/${libShort}/${videoId}/play_720p.mp4`,
      `https://storage.bunnycdn.com/${libShort}/${videoId}/play_480p.mp4`,
      `https://storage.bunnycdn.com/${libShort}/${videoId}/play_360p.mp4`,
    ];
    for (const u of urls) {
      const res = await fetch(u, { headers: { AccessKey: BUNNY_STREAM_STORAGE_KEY } });
      if (res.ok && res.body) {
        const downloadName = sanitizeDownloadName(fileName, 'mp4');
        return new Response(res.body, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'video/mp4',
            'Content-Disposition': `attachment; filename="${downloadName}"`,
            'Content-Length': res.headers.get('Content-Length') || '',
          },
        });
      }
    }
    return new Response(JSON.stringify({ error: 'Video not available for download' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Bunny CDN storage file (non-stream) — fetch via Bunny Storage API to bypass pull zone
  if (fileUrl.includes('b-cdn.net') || fileUrl.includes('bunnycdn')) {
    if (!BUNNY_STORAGE_ZONE || !BUNNY_API_KEY) {
      return new Response(JSON.stringify({ error: 'Storage not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    try {
      const u = new URL(fileUrl);
      const path = u.pathname.replace(/^\/+/, '');
      const storageUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${path}`;
      const res = await fetch(storageUrl, { headers: { AccessKey: BUNNY_API_KEY } });
      if (!res.ok || !res.body) {
        return new Response(JSON.stringify({ error: `Storage error ${res.status}` }), {
          status: res.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const ext = (fileName.split('.').pop() || 'bin').toLowerCase();
      return new Response(res.body, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${sanitizeDownloadName(fileName, ext)}"`,
          'Content-Length': res.headers.get('Content-Length') || '',
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid file URL' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // Fallback: Supabase storage signed URL — stream contents back so the browser triggers a download
  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const idx = fileUrl.indexOf('/deliverables/');
    const path = idx !== -1
      ? decodeURIComponent(fileUrl.slice(idx + '/deliverables/'.length).split('?')[0])
      : fileUrl;
    const { data: signed, error: signErr } = await sb.storage
      .from('deliverables')
      .createSignedUrl(path, 3600, { download: fileName });
    if (!signErr && signed?.signedUrl) {
      const res = await fetch(signed.signedUrl);
      if (res.ok && res.body) {
        const ext = (fileName.split('.').pop() || 'bin').toLowerCase();
        return new Response(res.body, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${sanitizeDownloadName(fileName, ext)}"`,
            'Content-Length': res.headers.get('Content-Length') || '',
          },
        });
      }
    }
  } catch (_) { /* fall through */ }

  return new Response(JSON.stringify({ error: 'Unsupported file source' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json();
    const { action, token, reviewer_name, content, timestamp_seconds, approval_action } = body;

    if (action === 'download') {
      const { data: link } = await supabaseAdmin
        .from('public_review_links')
        .select('id, deliverable_id, allow_download, expires_at, is_active, deliverables(id, file_name, file_url)')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (!link || !link.allow_download) {
        return new Response(JSON.stringify({ error: 'Download not allowed' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'Link expired' }), {
          status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return await proxyDownload(link.deliverables);
    }

    if (action === 'get_review') {
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
      let agencyId = '';
      if (deliverable?.project_id) {
        const { data: project } = await supabaseAdmin
          .from('projects')
          .select('title, agency_id')
          .eq('id', deliverable.project_id)
          .single();
        projectTitle = project?.title || '';
        agencyId = project?.agency_id || '';
      }

      // Lookup agency plan tier for "Powered by Veylodesk" badge
      let isFreePlan = false;
      if (agencyId) {
        const { data: agencyRow } = await supabaseAdmin
          .from('agencies')
          .select('plan_tier')
          .eq('id', agencyId)
          .maybeSingle();
        isFreePlan = (agencyRow?.plan_tier || 'free') === 'free';
      }

      // Generate signed URL for the video if it's in Supabase storage
      let signedUrl: string | null = null;
      const fileUrl = deliverable?.file_url || '';
      
      const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isBunnyStream = guidPattern.test(fileUrl) || 
        fileUrl.includes('.b-cdn.net/') || 
        fileUrl.includes('iframe.mediadelivery.net');
      
      if (!isBunnyStream && fileUrl.includes('/deliverables/')) {
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
          allow_comments: link.allow_comments,
          allow_download: link.allow_download,
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
          is_resolved: !!c.is_resolved,
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
        is_free_plan: isFreePlan,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'add_comment') {
      const { data: link } = await supabaseAdmin
        .from('public_review_links')
        .select('id, deliverable_id, expires_at, is_active, allow_comments')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (!link) {
        return new Response(JSON.stringify({ error: 'Invalid review link' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!link.allow_comments) {
        return new Response(JSON.stringify({ error: 'Comments are not allowed on this review link' }), {
          status: 403,
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

      // Get project info for notification
      const { data: deliverable } = await supabaseAdmin
        .from('deliverables')
        .select('project_id, file_name')
        .eq('id', link.deliverable_id)
        .single();

      if (deliverable?.project_id) {
        const { data: project } = await supabaseAdmin
          .from('projects')
          .select('agency_id, title')
          .eq('id', deliverable.project_id)
          .single();

        if (project) {
          await notifyAdmins(
            supabaseAdmin,
            project.agency_id,
            'New Review Comment',
            `${reviewer_name || 'A reviewer'} commented on "${project.title}": "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`,
            '/admin/projects',
            { project_id: deliverable.project_id, deliverable_id: link.deliverable_id, comment_id: comment.id }
          );
        }
      }

      return new Response(JSON.stringify({ ok: true, comment }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'approve_video') {
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

      if (approval_action === 'approve') {
        await supabaseAdmin
          .from('public_review_links')
          .update({ is_active: false })
          .eq('id', link.id);
      }

      // Notify admins about approval/rejection
      const { data: project } = await supabaseAdmin
        .from('projects')
        .select('agency_id, title')
        .eq('id', deliverable.project_id)
        .single();

      if (project) {
        const isApproval = approval_action === 'approve';
        await notifyAdmins(
          supabaseAdmin,
          project.agency_id,
          isApproval ? 'Video Approved via Review Link' : 'Revision Requested via Review Link',
          isApproval
            ? `${reviewer_name || 'A reviewer'} approved "${project.title}" via the public review link.`
            : `${reviewer_name || 'A reviewer'} requested revisions for "${project.title}" via the public review link.`,
          '/admin/projects',
          { project_id: deliverable.project_id, action: approval_action }
        );
      }

      return new Response(JSON.stringify({ ok: true, new_status: newStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'resolve_comment') {
      const { comment_id, resolved } = body as { comment_id: string; resolved: boolean };
      // Verify comment belongs to this token's review link
      const { data: link } = await supabaseAdmin
        .from('public_review_links')
        .select('id, is_active, expires_at')
        .eq('token', token)
        .eq('is_active', true)
        .single();
      if (!link) {
        return new Response(JSON.stringify({ error: 'Invalid review link' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (link.expires_at && new Date(link.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: 'Link expired' }), {
          status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: comment } = await supabaseAdmin
        .from('public_review_comments')
        .select('id, review_link_id')
        .eq('id', comment_id)
        .single();
      if (!comment || comment.review_link_id !== link.id) {
        return new Response(JSON.stringify({ error: 'Comment not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { error } = await supabaseAdmin
        .from('public_review_comments')
        .update({
          is_resolved: !!resolved,
          resolved_at: resolved ? new Date().toISOString() : null,
        } as any)
        .eq('id', comment_id);
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
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
