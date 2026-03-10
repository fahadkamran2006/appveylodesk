import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AgencyReport {
  agencyId: string;
  agencyName: string;
  adminEmail: string;
  monthName: string;
  startStr: string;
  endStr: string;
}

async function buildAndSendReport(
  supabase: any,
  resendKey: string,
  agency: { id: string; name: string },
  adminEmail: string,
  startDate: Date,
  endDate: Date,
  monthName: string
) {
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  // Get editors for this agency
  const { data: editorRoles } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("agency_id", agency.id)
    .eq("role", "editor");

  if (!editorRoles?.length) return false;

  const editorIds = editorRoles.map((e: any) => e.user_id);

  const [profilesRes, scheduleRes, logsRes, leavesRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", editorIds),
    supabase.from("agency_work_schedule").select("working_days, late_threshold_hour, late_threshold_minute").eq("agency_id", agency.id).single(),
    supabase.from("daily_logs").select("editor_id, date, check_in_at, check_out_at, log_type").eq("agency_id", agency.id).gte("date", startStr).lte("date", endStr),
    supabase.from("leave_requests").select("editor_id, start_date, end_date, status").eq("agency_id", agency.id).eq("status", "approved").lte("start_date", endStr).gte("end_date", startStr),
  ]);

  const editorProfiles = profilesRes.data || [];
  const schedule = scheduleRes.data;
  const logs = logsRes.data || [];
  const leaves = leavesRes.data || [];

  const workingDays = schedule?.working_days || [1, 2, 3, 4, 5];
  const lateHour = schedule?.late_threshold_hour ?? 10;
  const lateMinute = schedule?.late_threshold_minute ?? 0;
  const thresholdMinutes = lateHour * 60 + lateMinute;

  // Count working days in the month
  let totalWorkingDays = 0;
  const d = new Date(startDate);
  while (d <= endDate) {
    if (workingDays.includes(d.getDay())) totalWorkingDays++;
    d.setDate(d.getDate() + 1);
  }

  // Build per-editor stats
  const editorStats: { name: string; present: number; late: number; absent: number; onLeave: number; totalHours: number }[] = [];

  for (const editor of editorProfiles) {
    const editorLogs = logs.filter((l: any) => l.editor_id === editor.id);
    const editorLeaves = leaves.filter((l: any) => l.editor_id === editor.id);

    const leaveDates = new Set<string>();
    for (const leave of editorLeaves) {
      const ld = new Date(leave.start_date);
      const le = new Date(leave.end_date);
      while (ld <= le && ld <= endDate) {
        if (ld >= startDate) leaveDates.add(ld.toISOString().split("T")[0]);
        ld.setDate(ld.getDate() + 1);
      }
    }

    let present = 0, late = 0, absent = 0, onLeave = 0, totalHours = 0;
    const dayIter = new Date(startDate);
    while (dayIter <= endDate) {
      const dateStr = dayIter.toISOString().split("T")[0];
      const dayOfWeek = dayIter.getDay();
      if (workingDays.includes(dayOfWeek)) {
        if (leaveDates.has(dateStr)) {
          onLeave++;
        } else {
          const log = editorLogs.find((l: any) => l.date === dateStr);
          if (log?.check_in_at) {
            const checkIn = new Date(log.check_in_at);
            const checkInMinutes = checkIn.getHours() * 60 + checkIn.getMinutes();
            if (checkInMinutes > thresholdMinutes) late++;
            present++;
            if (log.check_out_at) {
              const checkOut = new Date(log.check_out_at);
              totalHours += (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
            }
          } else {
            absent++;
          }
        }
      }
      dayIter.setDate(dayIter.getDate() + 1);
    }

    editorStats.push({ name: editor.full_name || editor.email, present, late, absent, onLeave, totalHours: Math.round(totalHours * 10) / 10 });
  }

  // Build HTML email
  const editorRows = editorStats.map((e) => `
    <tr>
      <td style="padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 14px;">${e.name}</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #eee; text-align: center; color: #16a34a; font-weight: 600;">${e.present}</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #eee; text-align: center; color: #f59e0b; font-weight: 600;">${e.late}</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #eee; text-align: center; color: #ef4444; font-weight: 600;">${e.absent}</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #eee; text-align: center; color: #3b82f6; font-weight: 600;">${e.onLeave}</td>
      <td style="padding: 10px 14px; border-bottom: 1px solid #eee; text-align: center; font-weight: 600;">${e.totalHours}h</td>
    </tr>`).join("");

  const totalPresent = editorStats.reduce((s, e) => s + e.present, 0);
  const totalLate = editorStats.reduce((s, e) => s + e.late, 0);
  const totalAbsent = editorStats.reduce((s, e) => s + e.absent, 0);
  const avgAttendance = editorStats.length > 0 && totalWorkingDays > 0
    ? Math.round((totalPresent / (editorStats.length * totalWorkingDays)) * 100)
    : 0;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #ffffff; padding: 40px;">
      <h1 style="color: #1a1a2e; font-size: 22px; margin-bottom: 4px;">📊 Monthly Attendance Report</h1>
      <p style="color: #888; font-size: 14px; margin-top: 0;">${monthName} · ${agency.name}</p>
      <div style="display: flex; gap: 16px; margin: 24px 0;">
        <div style="background: #f0fdf4; border-radius: 10px; padding: 16px 20px; flex: 1; text-align: center;">
          <div style="font-size: 28px; font-weight: 700; color: #16a34a;">${avgAttendance}%</div>
          <div style="font-size: 12px; color: #555;">Attendance Rate</div>
        </div>
        <div style="background: #fff7ed; border-radius: 10px; padding: 16px 20px; flex: 1; text-align: center;">
          <div style="font-size: 28px; font-weight: 700; color: #f59e0b;">${totalLate}</div>
          <div style="font-size: 12px; color: #555;">Late Arrivals</div>
        </div>
        <div style="background: #fef2f2; border-radius: 10px; padding: 16px 20px; flex: 1; text-align: center;">
          <div style="font-size: 28px; font-weight: 700; color: #ef4444;">${totalAbsent}</div>
          <div style="font-size: 12px; color: #555;">Absent Days</div>
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 10px 14px; text-align: left; font-size: 12px; color: #666; text-transform: uppercase;">Editor</th>
            <th style="padding: 10px 14px; text-align: center; font-size: 12px; color: #666; text-transform: uppercase;">Present</th>
            <th style="padding: 10px 14px; text-align: center; font-size: 12px; color: #666; text-transform: uppercase;">Late</th>
            <th style="padding: 10px 14px; text-align: center; font-size: 12px; color: #666; text-transform: uppercase;">Absent</th>
            <th style="padding: 10px 14px; text-align: center; font-size: 12px; color: #666; text-transform: uppercase;">Leave</th>
            <th style="padding: 10px 14px; text-align: center; font-size: 12px; color: #666; text-transform: uppercase;">Hours</th>
          </tr>
        </thead>
        <tbody>
          ${editorRows || '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #999;">No editors found</td></tr>'}
        </tbody>
      </table>
      <p style="color: #999; font-size: 12px; margin-top: 30px; text-align: center;">
        Working days in ${monthName}: ${totalWorkingDays} · Late threshold: ${String(lateHour).padStart(2, "0")}:${String(lateMinute).padStart(2, "0")}
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #aaa; font-size: 12px; text-align: center;">Veylodesk — Attendance Report</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from: "Veylodesk <noreply@veylodesk.com>",
      to: [adminEmail],
      subject: `📊 Attendance Report — ${monthName}`,
      html,
    }),
  });

  if (res.ok) {
    await supabase.rpc("insert_system_log", {
      _event_type: "monthly_attendance_email",
      _message: `Attendance summary sent to ${adminEmail} for ${monthName}`,
      _metadata: { agency_id: agency.id, month: monthName },
    });
    return true;
  } else {
    console.error(`Failed to send to ${adminEmail}:`, await res.text());
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) throw new Error("RESEND_API_KEY not configured");

    let body: any = {};
    try { body = await req.json(); } catch {}

    // Manual mode: agency_id + month + year provided
    if (body.agency_id && body.month !== undefined && body.year) {
      const month = parseInt(body.month); // 0-indexed
      const year = parseInt(body.year);
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      const monthName = startDate.toLocaleString("en-US", { month: "long", year: "numeric" });

      // Get agency
      const { data: agency } = await supabase.from("agencies").select("id, name").eq("id", body.agency_id).single();
      if (!agency) throw new Error("Agency not found");

      // Get admin
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("agency_id", agency.id).eq("role", "admin");
      if (!adminRoles?.length) throw new Error("No admin found");

      const { data: adminProfile } = await supabase.from("profiles").select("email").eq("id", adminRoles[0].user_id).single();
      if (!adminProfile?.email) throw new Error("Admin email not found");

      const sent = await buildAndSendReport(supabase, resendKey, agency, adminProfile.email, startDate, endDate, monthName);

      return new Response(JSON.stringify({ success: sent, month: monthName }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Automatic mode (cron): only send to agencies with auto_monthly_report enabled
    const now = new Date();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const monthName = prevMonthStart.toLocaleString("en-US", { month: "long", year: "numeric" });

    const { data: agencies } = await supabase.from("agencies").select("id, name");
    let emailsSent = 0;

    for (const agency of agencies || []) {
      // Check if auto report is enabled
      const { data: schedule } = await supabase
        .from("agency_work_schedule")
        .select("auto_monthly_report")
        .eq("agency_id", agency.id)
        .single();

      if (!schedule?.auto_monthly_report) continue;

      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("agency_id", agency.id).eq("role", "admin");
      if (!adminRoles?.length) continue;

      const { data: adminProfile } = await supabase.from("profiles").select("email").eq("id", adminRoles[0].user_id).single();
      if (!adminProfile?.email) continue;

      const sent = await buildAndSendReport(supabase, resendKey, agency, adminProfile.email, prevMonthStart, prevMonthEnd, monthName);
      if (sent) emailsSent++;
    }

    return new Response(JSON.stringify({ success: true, emails_sent: emailsSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Monthly attendance summary error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
