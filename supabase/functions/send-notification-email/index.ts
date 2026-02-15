import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationPayload {
  user_id: string;
  agency_id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Supabase credentials not configured");
      return new Response(
        JSON.stringify({ error: "Database service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(resendApiKey);
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload = await req.json();
    console.log("Processing email notification:", payload);

    // Validate payload
    if (!payload.user_id || !payload.agency_id || !payload.type || !payload.title || !payload.message) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user has email notifications enabled for this type
    const { data: preference } = await supabase
      .from("notification_preferences")
      .select("email_enabled")
      .eq("user_id", payload.user_id)
      .eq("agency_id", payload.agency_id)
      .eq("notification_type", payload.type)
      .maybeSingle();

    // Default to disabled if no preference exists
    const emailEnabled = preference?.email_enabled ?? false;

    if (!emailEnabled) {
      console.log(`Email notifications disabled for user ${payload.user_id} and type ${payload.type}`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Email notifications disabled" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get user email
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", payload.user_id)
      .single();

    if (!profile?.email) {
      console.error(`User ${payload.user_id} not found or has no email`);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get agency name for branding
    const { data: agency } = await supabase
      .from("agencies")
      .select("name, branding")
      .eq("id", payload.agency_id)
      .single();

    const agencyName = agency?.name || "Veylodesk";
    const userName = profile.full_name || profile.email.split("@")[0];

    // Determine the link
    let actionLink = "";
    if (payload.link) {
      // Get the base URL from the Supabase URL (we'll use a placeholder for now)
      actionLink = payload.link;
    }

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${payload.title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 520px; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 32px; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); border-radius: 16px 16px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                ${agencyName}
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px; background-color: #18181b; border-radius: 0 0 16px 16px;">
              <p style="margin: 0 0 8px 0; color: #a1a1aa; font-size: 14px;">
                Hi ${userName},
              </p>
              
              <h2 style="margin: 16px 0; color: #ffffff; font-size: 18px; font-weight: 600;">
                ${payload.title}
              </h2>
              
              <p style="margin: 0 0 24px 0; color: #d4d4d8; font-size: 14px; line-height: 1.6;">
                ${payload.message}
              </p>
              
              ${actionLink ? `
              <a href="${actionLink}" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
                View Details
              </a>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; text-align: center;">
              <p style="margin: 0; color: #71717a; font-size: 12px;">
                You received this email because you have notifications enabled for ${agencyName}.
              </p>
              <p style="margin: 8px 0 0 0; color: #52525b; font-size: 11px;">
                Manage your notification preferences in your account settings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Send email
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: `${agencyName} <noreply@veylodesk.com>`,
      to: [profile.email],
      subject: payload.title,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      return new Response(
        JSON.stringify({ error: emailError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error in send-notification-email function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
