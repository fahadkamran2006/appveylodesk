

# Employee Attendance, Work Logs & Leave Management System

## Database Design

### Table: `daily_logs` (unified)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK, default gen_random_uuid() |
| editor_id | uuid | FK profiles, NOT NULL |
| agency_id | uuid | FK agencies, NOT NULL |
| date | date | default CURRENT_DATE |
| check_in_at | timestamptz | nullable (salaried only) |
| check_out_at | timestamptz | nullable (filled on checkout) |
| work_summary | text | nullable until checkout/submission |
| log_type | text | 'attendance' or 'task_update' |
| created_at | timestamptz | default now() |

### Table: `leave_requests`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| editor_id | uuid | FK profiles, NOT NULL |
| agency_id | uuid | FK agencies, NOT NULL |
| start_date | date | NOT NULL |
| end_date | date | NOT NULL |
| leave_type | text | 'sick', 'casual', 'unpaid' |
| reason | text | NOT NULL |
| status | text | 'pending', 'approved', 'rejected', default 'pending' |
| reviewed_by | uuid | nullable |
| reviewed_at | timestamptz | nullable |
| admin_note | text | nullable |
| created_at | timestamptz | default now() |

**RLS**: Editors can INSERT and SELECT their own records. Admins can SELECT all records in their agency. Admins can UPDATE leave_requests (approve/reject).

### Payroll Connection
- When admin marks payroll as paid, query `daily_logs` for that month to calculate total hours worked and days present
- Approved leaves with `leave_type = 'unpaid'` can auto-deduct from salaried pay (pro-rated: `monthly_salary / working_days * unpaid_leave_days`)
- Admin sees attendance summary (days present, hours logged, leaves taken) alongside payroll data

---

## UI Components

### 1. `src/components/attendance/AttendanceCard.tsx`
- Placed at top of Editor Dashboard
- **Salaried flow**: "Check In" button → creates `daily_logs` row with `log_type='attendance'`, `check_in_at=now()`. Shows elapsed timer. "Check Out" opens `CheckoutModal`
- **Freelance flow**: Simple textarea + submit for `log_type='task_update'` with `work_summary` and today's date
- Shows today's log history below the action area

### 2. `src/components/attendance/CheckoutModal.tsx`
- Dialog with required `work_summary` textarea
- On confirm: updates today's attendance row with `check_out_at` and `work_summary`

### 3. `src/components/attendance/LeaveRequestCard.tsx`
- Card on Editor Dashboard for submitting leave requests
- Date range picker, leave type dropdown, reason textarea
- Shows list of own past/pending requests with status badges

### 4. `src/components/admin/AttendanceReport.tsx`
- Integrated into Admin Team page (new "Attendance" tab or section in editor detail sheet)
- Date range filter, table showing: date, check-in, check-out, hours worked, work summary
- For freelancers: shows daily task logs
- Summary stats: total days present, total hours, avg hours/day

### 5. `src/components/admin/LeaveManagement.tsx`
- Section in Admin Team page or Payroll page
- Shows pending leave requests with approve/reject actions
- History of all leaves per editor

### 6. Payroll Integration (update `src/pages/admin/Payroll.tsx`)
- Add columns: "Days Present", "Hours Worked", "Leaves (Unpaid)" to each editor's payroll row
- Auto-calculate deductions for unpaid leaves for salaried staff
- Show attendance summary in the payment modal before confirming

---

## Implementation Steps

1. **Database migration** — Create `daily_logs` and `leave_requests` tables with RLS policies
2. **Build AttendanceCard + CheckoutModal** — Editor-facing check-in/out and task log
3. **Build LeaveRequestCard** — Editor-facing leave submission
4. **Integrate into Editor Dashboard** — Add attendance and leave cards above the kanban board
5. **Build AttendanceReport** — Admin view with date filters and stats
6. **Build LeaveManagement** — Admin approve/reject leave requests
7. **Update Payroll page** — Connect attendance data and leave deductions to payment flow

