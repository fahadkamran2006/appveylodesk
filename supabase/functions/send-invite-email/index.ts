import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailRequest {
  invitationId: string;
  email: string;
  role: "client" | "editor";
  agencyName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error("JWT validation failed:", claimsError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Authenticated user:", claimsData.claims.sub);

    const { invitationId, email, role, agencyName }: InviteEmailRequest = await req.json();

    console.log(`Sending invite email to ${email} for role ${role} at ${agencyName}`);

    const siteUrl = Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", "") || "https://your-app.lovable.app";
    const inviteLink = `${siteUrl}/auth/signup?invite=${invitationId}`;

    const roleLabel = role === "client" ? "client" : "team member";

    const emailResponse = await resend.emails.send({
      from: "Veylodesk <invites@send.veylodesk.com>",
      reply_to: "hello@veylodesk.com",
      to: [email],
      subject: `You've been invited to join ${agencyName} on Veylodesk`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invitation to Veylodesk</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <div style="max-width: 560px; margin: 0 auto; padding: 40px 20px;">
              <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16162a 100%); border-radius: 16px; padding: 40px; border: 1px solid rgba(139, 92, 246, 0.2);">
                
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="color: #ffffff; font-size: 24px; font-weight: 600; margin: 0;">You're Invited!</h1>
                </div>
                
                <p style="color: #a1a1aa; font-size: 16px; line-height: 1.6; margin: 0 0 24px;">
                  <strong style="color: #ffffff;">${agencyName}</strong> has invited you to join their team as a <strong style="color: #8b5cf6;">${roleLabel}</strong> on Veylodesk.
                </p>
                
                <p style="color: #a1a1aa; font-size: 16px; line-height: 1.6; margin: 0 0 32px;">
                  Click the button below to create your account and get started.
                </p>
                
                <div style="text-align: center; margin-bottom: 32px;">
                  <a href="${inviteLink}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Accept Invitation
                  </a>
                </div>
                
                <p style="color: #71717a; font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
                  Or copy and paste this link into your browser:
                </p>
                
                <p style="color: #8b5cf6; font-size: 14px; word-break: break-all; background: rgba(139, 92, 246, 0.1); padding: 12px; border-radius: 8px; margin: 0 0 32px;">
                  ${inviteLink}
                </p>
                
                <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 32px 0;">
                
                <p style="color: #52525b; font-size: 12px; text-align: center; margin: 0;">
                  This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
                </p>
              </div>
              
              <p style="color: #52525b; font-size: 12px; text-align: center; margin-top: 24px;">
                Powered by Veylodesk
              </p>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-invite-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
