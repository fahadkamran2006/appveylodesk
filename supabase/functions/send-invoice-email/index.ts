import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InvoiceEmailPayload {
  invoice_id: string;
}

const handler = async (req: Request): Promise<Response> => {
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

    const payload: InvoiceEmailPayload = await req.json();
    console.log("Processing invoice email:", payload);

    if (!payload.invoice_id) {
      return new Response(
        JSON.stringify({ error: "Missing invoice_id" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch invoice with all related data
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        amount,
        subtotal,
        tax_rate,
        tax_amount,
        due_date,
        payment_link,
        notes,
        client_id,
        agency_id,
        payment_method_id,
        project:projects(id, title)
      `)
      .eq("id", payload.invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error("Invoice not found:", invoiceError);
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get client profile
    const { data: client } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", invoice.client_id)
      .single();

    if (!client?.email) {
      console.error("Client email not found");
      return new Response(
        JSON.stringify({ error: "Client email not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get agency info
    const { data: agency } = await supabase
      .from("agencies")
      .select("id, name, logo_url")
      .eq("id", invoice.agency_id)
      .single();

    // Get payment method if exists
    let paymentMethod = null;
    if (invoice.payment_method_id) {
      const { data: pm } = await supabase
        .from("payment_methods")
        .select("id, name, details, payment_link")
        .eq("id", invoice.payment_method_id)
        .single();
      paymentMethod = pm;
    }

    // Get line items
    const { data: lineItems } = await supabase
      .from("invoice_line_items")
      .select("*")
      .eq("invoice_id", payload.invoice_id)
      .order("sort_order", { ascending: true });

    const agencyName = agency?.name || "Veylodesk";
    const clientName = client.full_name || client.email.split("@")[0];
    const projectTitle = invoice.project?.title || "Project";
    const invoiceNumber = invoice.invoice_number || "Invoice";
    const paymentLink = invoice.payment_link || paymentMethod?.payment_link;

    // Build line items HTML
    let lineItemsHtml = "";
    if (lineItems && lineItems.length > 0) {
      lineItemsHtml = lineItems
        .map(
          (item: any) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #27272a; color: #fafafa;">
            ${item.description}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #27272a; text-align: center; color: #a1a1aa;">
            ${item.quantity}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #27272a; text-align: right; color: #a1a1aa;">
            $${Number(item.rate).toFixed(2)}
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #27272a; text-align: right; color: #fafafa; font-weight: 500;">
            $${Number(item.amount).toFixed(2)}
          </td>
        </tr>
      `
        )
        .join("");
    }

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${invoiceNumber} from ${agencyName}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); border-radius: 16px 16px 0 0;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                      ${agencyName}
                    </h1>
                  </td>
                  <td style="text-align: right;">
                    <span style="color: rgba(255,255,255,0.9); font-size: 14px;">
                      ${invoiceNumber}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px; background-color: #18181b;">
              <p style="margin: 0 0 8px 0; color: #a1a1aa; font-size: 14px;">
                Hi ${clientName},
              </p>
              
              <h2 style="margin: 16px 0; color: #ffffff; font-size: 20px; font-weight: 600;">
                You have a new invoice for ${projectTitle}
              </h2>
              
              ${
                lineItems && lineItems.length > 0
                  ? `
              <!-- Line Items Table -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 24px 0;">
                <thead>
                  <tr style="border-bottom: 2px solid #27272a;">
                    <th style="padding: 12px; text-align: left; color: #71717a; font-size: 12px; font-weight: 500; text-transform: uppercase;">Description</th>
                    <th style="padding: 12px; text-align: center; color: #71717a; font-size: 12px; font-weight: 500; text-transform: uppercase;">Qty</th>
                    <th style="padding: 12px; text-align: right; color: #71717a; font-size: 12px; font-weight: 500; text-transform: uppercase;">Rate</th>
                    <th style="padding: 12px; text-align: right; color: #71717a; font-size: 12px; font-weight: 500; text-transform: uppercase;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${lineItemsHtml}
                </tbody>
              </table>
              
              <!-- Totals -->
              <table role="presentation" style="width: 100%; max-width: 250px; margin-left: auto; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #a1a1aa; font-size: 14px;">Subtotal</td>
                  <td style="padding: 8px 0; text-align: right; color: #fafafa; font-size: 14px;">$${Number(
                    invoice.subtotal || 0
                  ).toFixed(2)}</td>
                </tr>
                ${
                  Number(invoice.tax_rate) > 0
                    ? `
                <tr>
                  <td style="padding: 8px 0; color: #a1a1aa; font-size: 14px;">Tax (${invoice.tax_rate}%)</td>
                  <td style="padding: 8px 0; text-align: right; color: #fafafa; font-size: 14px;">$${Number(
                    invoice.tax_amount || 0
                  ).toFixed(2)}</td>
                </tr>
                `
                    : ""
                }
                <tr style="border-top: 2px solid #27272a;">
                  <td style="padding: 16px 0 0; color: #fafafa; font-size: 18px; font-weight: 700;">Total</td>
                  <td style="padding: 16px 0 0; text-align: right; color: #fafafa; font-size: 18px; font-weight: 700;">$${Number(
                    invoice.amount
                  ).toFixed(2)}</td>
                </tr>
              </table>
              `
                  : `
              <div style="text-align: center; padding: 24px; background-color: #27272a; border-radius: 12px; margin: 24px 0;">
                <p style="margin: 0; color: #a1a1aa; font-size: 14px;">Amount Due</p>
                <p style="margin: 8px 0 0; color: #ffffff; font-size: 32px; font-weight: 700;">$${Number(
                  invoice.amount
                ).toLocaleString()}</p>
              </div>
              `
              }

              ${
                invoice.due_date
                  ? `
              <p style="margin: 24px 0 0; color: #a1a1aa; font-size: 14px;">
                <strong style="color: #fafafa;">Due Date:</strong> ${new Date(
                  invoice.due_date
                ).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              `
                  : ""
              }

              ${
                paymentMethod
                  ? `
              <div style="margin-top: 24px; padding: 16px; background-color: #27272a; border-radius: 8px;">
                <p style="margin: 0 0 8px; color: #fafafa; font-size: 14px; font-weight: 600;">
                  Payment Method: ${paymentMethod.name}
                </p>
                <p style="margin: 0; color: #a1a1aa; font-size: 13px; white-space: pre-wrap; line-height: 1.5;">
                  ${paymentMethod.details}
                </p>
              </div>
              `
                  : ""
              }

              ${
                paymentLink
                  ? `
              <div style="text-align: center; margin-top: 32px;">
                <a href="${paymentLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                  Pay Now
                </a>
              </div>
              `
                  : ""
              }
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #18181b; border-radius: 0 0 16px 16px; border-top: 1px solid #27272a;">
              <p style="margin: 0; color: #71717a; font-size: 12px; text-align: center;">
                This invoice was sent by ${agencyName}. If you have any questions, please contact us.
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

    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: `${agencyName} <noreply@veylodesk.com>`,
      to: [client.email],
      subject: `${invoiceNumber} - $${Number(invoice.amount).toFixed(2)} for ${projectTitle}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      return new Response(
        JSON.stringify({ error: emailError.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Invoice email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult?.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error in send-invoice-email function:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
