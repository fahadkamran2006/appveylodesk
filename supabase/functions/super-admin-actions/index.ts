import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPER_ADMIN_EMAILS = ["hello@fahadkamran.com", "m.fahadkamran0001@gmail.com"];

async function verifySuperAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabaseUser.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("Unauthorized");
  if (!SUPER_ADMIN_EMAILS.includes(data.claims.email as string)) throw new Error("Forbidden");
  return data.claims.email as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    await verifySuperAdmin(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "delete_agency": {
        const { agency_id } = body;
        // Delete all related data in order
        // 1. Delete deliverable comments
        const { data: projects } = await supabase
          .from("projects").select("id").eq("agency_id", agency_id);
        const projectIds = (projects || []).map((p: any) => p.id);
        
        if (projectIds.length > 0) {
          const { data: deliverables } = await supabase
            .from("deliverables").select("id").in("project_id", projectIds);
          const deliverableIds = (deliverables || []).map((d: any) => d.id);
          
          if (deliverableIds.length > 0) {
            await supabase.from("deliverable_comments").delete().in("deliverable_id", deliverableIds);
            await supabase.from("public_review_links").delete().in("deliverable_id", deliverableIds);
            await supabase.from("deliverables").delete().in("project_id", projectIds);
          }
          
          await supabase.from("project_editors").delete().in("project_id", projectIds);
          await supabase.from("cancellation_requests").delete().in("project_id", projectIds);
          await supabase.from("invoices").delete().in("project_id", projectIds);
        }

        // 2. Delete channels & messages
        const { data: channels } = await supabase
          .from("channels").select("id").eq("agency_id", agency_id);
        const channelIds = (channels || []).map((c: any) => c.id);
        
        if (channelIds.length > 0) {
          await supabase.from("messages").delete().in("channel_id", channelIds);
          await supabase.from("channel_participants").delete().in("channel_id", channelIds);
          await supabase.from("channel_read_receipts").delete().in("channel_id", channelIds);
          await supabase.from("channel_mutes").delete().in("channel_id", channelIds);
          await supabase.from("cleared_chats").delete().in("channel_id", channelIds);
          await supabase.from("channels").delete().eq("agency_id", agency_id);
        }

        // 3. Delete other agency data
        await supabase.from("projects").delete().eq("agency_id", agency_id);
        await supabase.from("project_containers").delete().eq("agency_id", agency_id);
        await supabase.from("notifications").delete().eq("agency_id", agency_id);
        await supabase.from("notification_preferences").delete().eq("agency_id", agency_id);
        await supabase.from("payment_methods").delete().eq("agency_id", agency_id);
        await supabase.from("payroll_payments").delete().eq("agency_id", agency_id);
        await supabase.from("editor_balances").delete().eq("agency_id", agency_id);
        await supabase.from("agency_invitations").delete().eq("agency_id", agency_id);
        await supabase.from("agency_restrictions").delete().eq("agency_id", agency_id);

        // 4. Delete user roles & profiles
        const { data: members } = await supabase
          .from("user_roles").select("user_id").eq("agency_id", agency_id);
        const memberIds = (members || []).map((m: any) => m.user_id);
        
        await supabase.from("user_roles").delete().eq("agency_id", agency_id);
        
        if (memberIds.length > 0) {
          await supabase.from("profiles").delete().in("id", memberIds);
        }

        // 5. Delete agency itself
        await supabase.from("agencies").delete().eq("id", agency_id);

        // Log it
        await supabase.rpc("insert_system_log", {
          _event_type: "agency_deleted",
          _message: `Agency ${agency_id} deleted by super admin`,
          _metadata: { agency_id },
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "cancel_subscription": {
        const { agency_id } = body;
        await supabase.from("agencies").update({
          subscription_plan: "none",
          plan_tier: "free",
          subscription_ends_at: new Date().toISOString(),
        }).eq("id", agency_id);

        await supabase.rpc("insert_system_log", {
          _event_type: "subscription_cancelled_by_admin",
          _message: `Subscription cancelled for agency ${agency_id} by super admin`,
          _metadata: { agency_id },
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "add_restriction": {
        const { agency_id, restriction_type, message, expires_at } = body;
        
        // Deactivate existing restrictions of same type
        await supabase.from("agency_restrictions")
          .update({ is_active: false })
          .eq("agency_id", agency_id)
          .eq("restriction_type", restriction_type)
          .eq("is_active", true);

        const { error } = await supabase.from("agency_restrictions").insert({
          agency_id,
          restriction_type,
          message: message || `Your account has been ${restriction_type === 'blocked' ? 'suspended' : restriction_type === 'read_only' ? 'set to read-only' : 'given a warning'}.`,
          created_by: body.created_by || "00000000-0000-0000-0000-000000000000",
          expires_at: expires_at || null,
          is_active: true,
        });
        if (error) throw error;

        await supabase.rpc("insert_system_log", {
          _event_type: "restriction_added",
          _message: `${restriction_type} restriction added to agency ${agency_id}`,
          _metadata: { agency_id, restriction_type, expires_at },
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "remove_restriction": {
        const { agency_id, restriction_type } = body;
        await supabase.from("agency_restrictions")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("agency_id", agency_id)
          .eq("restriction_type", restriction_type)
          .eq("is_active", true);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send_custom_email": {
        const { to_email, subject, html_body } = body;
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (!resendKey) throw new Error("RESEND_API_KEY not configured");

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "Veylodesk <onboarding@resend.dev>",
            to: [to_email],
            subject,
            html: html_body,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Email send failed: ${errText}`);
        }

        await supabase.rpc("insert_system_log", {
          _event_type: "custom_email_sent",
          _message: `Custom email sent to ${to_email}: ${subject}`,
          _metadata: { to_email, subject },
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send_marketing_email": {
        const { user_id, to_email, email_type, subject, html_body } = body;
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (!resendKey) throw new Error("RESEND_API_KEY not configured");

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: "Veylodesk <onboarding@resend.dev>",
            to: [to_email],
            subject,
            html: html_body,
          }),
        });

        if (!res.ok) throw new Error("Failed to send marketing email");

        // Log it
        await supabase.from("marketing_emails_log").insert({
          user_id,
          email_type,
          metadata: { subject, to_email },
        });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_marketing_analytics": {
        // Get users who haven't created a project in 15+ days
        const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
        
        // Get all admins (agency creators)
        const { data: allRoles } = await supabase
          .from("user_roles")
          .select("user_id, agency_id, role, created_at")
          .eq("role", "admin");

        const inactiveUsers: any[] = [];
        for (const role of allRoles || []) {
          // Check if agency has any projects
          const { count } = await supabase
            .from("projects")
            .select("id", { count: "exact", head: true })
            .eq("agency_id", role.agency_id);

          if ((count || 0) === 0 && new Date(role.created_at) < new Date(fifteenDaysAgo)) {
            // Get profile
            const { data: profile } = await supabase
              .from("profiles")
              .select("email, full_name")
              .eq("id", role.user_id)
              .single();

            // Check if we already sent this email type
            const { count: emailCount } = await supabase
              .from("marketing_emails_log")
              .select("id", { count: "exact", head: true })
              .eq("user_id", role.user_id)
              .eq("email_type", "onboarding_nudge");

            inactiveUsers.push({
              user_id: role.user_id,
              agency_id: role.agency_id,
              email: profile?.email,
              full_name: profile?.full_name,
              created_at: role.created_at,
              days_since_signup: Math.floor((Date.now() - new Date(role.created_at).getTime()) / (1000 * 60 * 60 * 24)),
              onboarding_email_sent: (emailCount || 0) > 0,
            });
          }
        }

        // Get marketing email stats
        const { data: emailLogs } = await supabase
          .from("marketing_emails_log")
          .select("*")
          .order("sent_at", { ascending: false })
          .limit(50);

        return new Response(JSON.stringify({
          inactive_users: inactiveUsers,
          recent_emails: emailLogs || [],
          total_inactive: inactiveUsers.length,
          total_emails_sent: emailLogs?.length || 0,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "send_bulk_onboarding_emails": {
        const { users } = body;
        const resendKey = Deno.env.get("RESEND_API_KEY");
        if (!resendKey) throw new Error("RESEND_API_KEY not configured");

        let sent = 0;
        for (const user of users) {
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 40px;">
              <h1 style="color: #1a1a2e; font-size: 24px;">Hey ${user.full_name || "there"} 👋</h1>
              <p style="color: #555; font-size: 16px; line-height: 1.6;">
                We noticed you signed up for <strong>Veylodesk</strong> but haven't created your first project yet.
              </p>
              <p style="color: #555; font-size: 16px; line-height: 1.6;">
                Getting started is easy — here's how:
              </p>
              <ol style="color: #555; font-size: 15px; line-height: 1.8;">
                <li><strong>Invite your first client</strong> — Go to Clients → Invite</li>
                <li><strong>Create a project</strong> — Set up your first video editing project</li>
                <li><strong>Upload deliverables</strong> — Share drafts and get feedback</li>
                <li><strong>Send invoices</strong> — Get paid right from the platform</li>
              </ol>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://appveylodesk.lovable.app/admin/dashboard" style="background: #6366f1; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                  Go to Dashboard →
                </a>
              </div>
              <p style="color: #888; font-size: 13px; margin-top: 30px;">
                Need help? Reply to this email and we'll assist you personally.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="color: #aaa; font-size: 12px; text-align: center;">
                Veylodesk — The video editing agency platform
              </p>
            </div>
          `;

          try {
            const res = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${resendKey}`,
              },
              body: JSON.stringify({
                from: "Veylodesk <onboarding@resend.dev>",
                to: [user.email],
                subject: "You're all set up — here's how to onboard your first client 🚀",
                html,
              }),
            });

            if (res.ok) {
              await supabase.from("marketing_emails_log").insert({
                user_id: user.user_id,
                email_type: "onboarding_nudge",
                metadata: { email: user.email },
              });
              sent++;
            }
          } catch (e) {
            console.error(`Failed to send to ${user.email}:`, e);
          }
        }

        return new Response(JSON.stringify({ success: true, sent }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    const status = err.message === "Unauthorized" ? 401 : err.message === "Forbidden" ? 403 : 500;
    return new Response(JSON.stringify({ error: err.message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
