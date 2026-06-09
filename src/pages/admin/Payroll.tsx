import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { Button } from '@/components/ui/button';
import { AddBonusModal } from '@/components/admin/AddBonusModal';
import { PayrollPaymentModal } from '@/components/admin/PayrollPaymentModal';
import { AddBalanceModal } from '@/components/admin/AddBalanceModal';
import { supabase } from '@/integrations/supabase/client';
import { 
  DollarSign, 
  Users, 
  Briefcase, 
  Gift,
  Loader2,
  TrendingUp,
  CheckCircle2,
  Wallet,
  History,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Database } from '@/integrations/supabase/types';

type EmploymentType = Database['public']['Enums']['employment_type'];

interface EditorPayroll {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  employment_type: EmploymentType;
  monthly_salary: number | null;
  accumulated_bonus: number;
  freelance_earnings: number;
  completed_videos: number;
  isPaidThisMonth: boolean;
  balanceOwed: number;
  daysPresent: number;
  hoursWorked: number;
  unpaidLeaveDays: number;
}

interface PaymentHistoryRecord {
  id: string;
  editor_id: string;
  period_month: number;
  period_year: number;
  base_amount: number;
  bonus_amount: number;
  total_amount: number;
  status: string;
  paid_at: string | null;
  note: string | null;
}

const AdminPayroll = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [editors, setEditors] = useState<EditorPayroll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [agencyId, setAgencyId] = useState<string>('');
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [selectedEditor, setSelectedEditor] = useState<EditorPayroll | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryRecord[]>([]);
  const [expandedEditor, setExpandedEditor] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'admin' && userRole !== 'staff') {
      navigate(userRole === 'client' ? '/client/dashboard' : '/editor/dashboard');
    }
  }, [user, userRole, loading, navigate]);

  const fetchPayrollData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRoleData?.agency_id) {
        setIsLoading(false);
        return;
      }

      const aid = userRoleData.agency_id;
      setAgencyId(aid);

      const { data: editorRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('agency_id', aid)
        .eq('role', 'editor');

      if (!editorRoles || editorRoles.length === 0) {
        setEditors([]);
        setIsLoading(false);
        return;
      }

      const editorIds = editorRoles.map(r => r.user_id);

      const [{ data: profilesRaw }, { data: compsRaw }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url, employment_type')
          .in('id', editorIds),
        (supabase as any)
          .from('employee_compensation')
          .select('user_id, monthly_salary, accumulated_bonus')
          .in('user_id', editorIds),
      ]);
      const compByUser = new Map<string, { monthly_salary: number | null; accumulated_bonus: number }>(
        ((compsRaw as any[]) || []).map((c) => [c.user_id, { monthly_salary: c.monthly_salary, accumulated_bonus: c.accumulated_bonus ?? 0 }])
      );
      const profiles = ((profilesRaw as any[]) || []).map((p) => {
        const c = compByUser.get(p.id);
        return { ...p, monthly_salary: c?.monthly_salary ?? null, accumulated_bonus: c?.accumulated_bonus ?? 0 };
      });

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: projectEditors } = await supabase
        .from('project_editors')
        .select(`
          editor_id,
          project:projects(
            id,
            status,
            editor_rate,
            completed_at
          )
        `)
        .in('editor_id', editorIds);

      const earningsMap = new Map<string, { freelanceEarnings: number; completedVideos: number }>();
      
      (projectEditors || []).forEach(pe => {
        const project = pe.project as any;
        if (!project) return;
        const editorId = pe.editor_id;
        const current = earningsMap.get(editorId) || { freelanceEarnings: 0, completedVideos: 0 };
        if (project.status === 'done' && project.completed_at) {
          const completedDate = new Date(project.completed_at);
          if (completedDate >= startOfMonth) {
            current.freelanceEarnings += project.editor_rate || 0;
            current.completedVideos += 1;
          }
        }
        earningsMap.set(editorId, current);
      });

      // Fetch payment status for this month
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      // Fetch in parallel: payments, balances, payment history, attendance logs, leave requests
      const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
      const monthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

      const [paymentsRes, balancesRes, allPaymentsRes, logsRes, leavesRes] = await Promise.all([
        supabase.from('payroll_payments').select('editor_id, status')
          .eq('agency_id', aid).eq('period_month', currentMonth).eq('period_year', currentYear).eq('status', 'paid'),
        supabase.from('editor_balances').select('editor_id, amount, type').eq('agency_id', aid),
        supabase.from('payroll_payments').select('*').eq('agency_id', aid)
          .order('period_year', { ascending: false }).order('period_month', { ascending: false }),
        supabase.from('daily_logs').select('editor_id, check_in_at, check_out_at, log_type')
          .eq('agency_id', aid).gte('date', monthStart).lte('date', monthEnd).eq('log_type', 'attendance'),
        supabase.from('leave_requests').select('editor_id, start_date, end_date, leave_type, status')
          .eq('agency_id', aid).eq('status', 'approved').eq('leave_type', 'unpaid')
          .gte('end_date', monthStart).lte('start_date', monthEnd),
      ]);

      const paidSet = new Set((paymentsRes.data || []).map(p => p.editor_id));

      const balanceMap = new Map<string, number>();
      (balancesRes.data || []).forEach((b: any) => {
        const current = balanceMap.get(b.editor_id) || 0;
        balanceMap.set(b.editor_id, current + (b.type === 'owed' ? b.amount : -b.amount));
      });

      setPaymentHistory((allPaymentsRes.data || []) as PaymentHistoryRecord[]);

      // Calculate attendance stats per editor
      const attendanceMap = new Map<string, { days: number; hoursMs: number }>();
      (logsRes.data || []).forEach((log: any) => {
        const current = attendanceMap.get(log.editor_id) || { days: 0, hoursMs: 0 };
        if (log.check_in_at) current.days += 1;
        if (log.check_in_at && log.check_out_at) {
          current.hoursMs += new Date(log.check_out_at).getTime() - new Date(log.check_in_at).getTime();
        }
        attendanceMap.set(log.editor_id, current);
      });

      // Calculate unpaid leave days per editor for this month
      const unpaidLeaveMap = new Map<string, number>();
      (leavesRes.data || []).forEach((leave: any) => {
        const start = new Date(Math.max(new Date(leave.start_date).getTime(), new Date(monthStart).getTime()));
        const end = new Date(Math.min(new Date(leave.end_date).getTime(), new Date(monthEnd).getTime()));
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const current = unpaidLeaveMap.get(leave.editor_id) || 0;
        unpaidLeaveMap.set(leave.editor_id, current + Math.max(0, days));
      });

      const payrollData: EditorPayroll[] = (profiles || []).map(profile => {
        const earnings = earningsMap.get(profile.id) || { freelanceEarnings: 0, completedVideos: 0 };
        const attendance = attendanceMap.get(profile.id) || { days: 0, hoursMs: 0 };
        return {
          id: profile.id,
          full_name: profile.full_name,
          email: profile.email,
          avatar_url: profile.avatar_url,
          employment_type: profile.employment_type || 'freelance',
          monthly_salary: profile.monthly_salary,
          accumulated_bonus: profile.accumulated_bonus || 0,
          freelance_earnings: earnings.freelanceEarnings,
          completed_videos: earnings.completedVideos,
          isPaidThisMonth: paidSet.has(profile.id),
          balanceOwed: balanceMap.get(profile.id) || 0,
          daysPresent: attendance.days,
          hoursWorked: Math.round(attendance.hoursMs / 3600000 * 10) / 10,
          unpaidLeaveDays: unpaidLeaveMap.get(profile.id) || 0,
        };
      });

      setEditors(payrollData);
    } catch (error) {
      console.error('Error fetching payroll data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && userRole === 'admin') {
      fetchPayrollData();
    }
  }, [user, userRole]);

  const handleAddBonus = (editor: EditorPayroll) => {
    setSelectedEditor(editor);
    setBonusModalOpen(true);
  };

  const handleMarkPaid = (editor: EditorPayroll) => {
    setSelectedEditor(editor);
    setPaymentModalOpen(true);
  };

  const handleAddBalance = (editor: EditorPayroll) => {
    setSelectedEditor(editor);
    setBalanceModalOpen(true);
  };

  const totals = useMemo(() => {
    const freelancers = editors.filter(e => e.employment_type === 'freelance');
    const salaried = editors.filter(e => e.employment_type === 'salaried');
    return {
      freelancerCount: freelancers.length,
      salariedCount: salaried.length,
      freelanceTotal: freelancers.reduce((sum, e) => sum + e.freelance_earnings, 0),
      salaryTotal: salaried.reduce((sum, e) => sum + (e.monthly_salary || 0) + e.accumulated_bonus, 0),
      paidCount: editors.filter(e => e.isPaidThisMonth).length,
      unpaidCount: editors.filter(e => !e.isPaidThisMonth).length,
    };
  }, [editors]);

  const getInitials = (name: string | null, email: string) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return email.slice(0, 2).toUpperCase();
  };

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const getEditorHistory = (editorId: string) => paymentHistory.filter(p => p.editor_id === editorId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Payroll | Veylodesk</title>
        <meta name="description" content="Manage editor payroll and compensation." />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        <div className="hidden md:block">
          <CollapsibleSidebar role="admin" />
        </div>

        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Payroll</h1>
            <p className="text-muted-foreground mt-1">Manage editor compensation, payments, and balances</p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Team</p>
                      <p className="text-xl font-bold text-foreground">{editors.length}</p>
                    </div>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Paid</p>
                      <p className="text-xl font-bold text-foreground">{totals.paidCount}</p>
                    </div>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Unpaid</p>
                      <p className="text-xl font-bold text-foreground">{totals.unpaidCount}</p>
                    </div>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Payroll</p>
                      <p className="text-xl font-bold text-foreground">${(totals.freelanceTotal + totals.salaryTotal).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payroll Table */}
              <div className="glass-card rounded-xl overflow-hidden">
                <div className="p-6 border-b border-border/50">
                  <h2 className="text-lg font-semibold text-foreground">This Month's Payroll</h2>
                  <p className="text-sm text-muted-foreground">
                    {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </p>
                </div>

                {editors.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No editors in your team yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/30">
                        <tr>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Editor</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Type</th>
                          <th className="text-center p-4 text-sm font-medium text-muted-foreground">Days</th>
                          <th className="text-center p-4 text-sm font-medium text-muted-foreground">Hours</th>
                          <th className="text-center p-4 text-sm font-medium text-muted-foreground">Leaves</th>
                          <th className="text-right p-4 text-sm font-medium text-muted-foreground">Base</th>
                          <th className="text-right p-4 text-sm font-medium text-muted-foreground">Bonus</th>
                          <th className="text-right p-4 text-sm font-medium text-muted-foreground">Total</th>
                          <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                          <th className="text-right p-4 text-sm font-medium text-muted-foreground">Owed</th>
                          <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {editors.map((editor) => {
                          const isSalaried = editor.employment_type === 'salaried';
                          const basePay = isSalaried ? (editor.monthly_salary || 0) : editor.freelance_earnings;
                          const bonus = isSalaried ? editor.accumulated_bonus : 0;
                          const total = basePay + bonus;
                          const history = getEditorHistory(editor.id);
                          const isExpanded = expandedEditor === editor.id;

                          return (
                            <>
                              <tr key={editor.id} className="hover:bg-muted/20">
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="w-9 h-9">
                                      <AvatarImage src={editor.avatar_url || undefined} />
                                      <AvatarFallback className="bg-primary/20 text-primary text-xs">
                                        {getInitials(editor.full_name, editor.email)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium text-foreground text-sm">{editor.full_name || 'Unnamed'}</p>
                                      <p className="text-xs text-muted-foreground">{editor.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <Badge variant="secondary" className={cn(
                                    "text-xs",
                                    isSalaried
                                      ? 'bg-primary/10 text-primary border border-primary/20'
                                      : 'bg-muted text-muted-foreground'
                                  )}>
                                    {isSalaried ? 'Salaried' : 'Freelance'}
                                  </Badge>
                                </td>
                                <td className="p-4 text-center text-sm text-foreground">{editor.daysPresent}</td>
                                <td className="p-4 text-center text-sm text-foreground">{editor.hoursWorked > 0 ? `${editor.hoursWorked}h` : '-'}</td>
                                <td className="p-4 text-center text-sm">
                                  {editor.unpaidLeaveDays > 0 ? (
                                    <Badge variant="secondary" className="text-xs bg-destructive/10 text-destructive border border-destructive/20">
                                      {editor.unpaidLeaveDays}d
                                    </Badge>
                                  ) : <span className="text-muted-foreground">-</span>}
                                </td>
                                <td className="p-4 text-right font-medium text-foreground text-sm">${basePay.toLocaleString()}</td>
                                <td className="p-4 text-right text-sm">
                                  <span className={cn("font-medium", bonus > 0 ? "text-success" : "text-muted-foreground")}>
                                    {bonus > 0 ? `+$${bonus.toLocaleString()}` : '-'}
                                  </span>
                                </td>
                                <td className="p-4 text-right font-bold text-foreground">${total.toLocaleString()}</td>
                                <td className="p-4 text-center">
                                  <Badge variant="secondary" className={cn(
                                    "text-xs",
                                    editor.isPaidThisMonth
                                      ? 'bg-success/10 text-success border border-success/20'
                                      : 'bg-warning/10 text-warning border border-warning/20'
                                  )}>
                                    {editor.isPaidThisMonth ? 'Paid' : 'Unpaid'}
                                  </Badge>
                                </td>
                                <td className="p-4 text-right text-sm">
                                  <span className={cn(
                                    "font-medium",
                                    editor.balanceOwed > 0 ? "text-primary" : "text-muted-foreground"
                                  )}>
                                    {editor.balanceOwed > 0 ? `$${editor.balanceOwed.toLocaleString()}` : '-'}
                                  </span>
                                </td>
                                <td className="p-4 text-right">
                                  <div className="flex items-center justify-end gap-1 flex-wrap">
                                    {!editor.isPaidThisMonth && (
                                      <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => handleMarkPaid(editor)}>
                                        <CheckCircle2 className="w-3 h-3" />
                                        Pay
                                      </Button>
                                    )}
                                    {isSalaried && (
                                      <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => handleAddBonus(editor)}>
                                        <Gift className="w-3 h-3" />
                                        Bonus
                                      </Button>
                                    )}
                                    <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => handleAddBalance(editor)}>
                                      <Wallet className="w-3 h-3" />
                                      Balance
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      onClick={() => setExpandedEditor(isExpanded ? null : editor.id)}
                                    >
                                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                              {/* Expandable history row */}
                              {isExpanded && (
                                <tr key={`${editor.id}-history`}>
                                  <td colSpan={11} className="p-0">
                                    <div className="bg-muted/20 p-4 border-t border-border/30">
                                      <div className="flex items-center gap-2 mb-3">
                                        <History className="w-4 h-4 text-muted-foreground" />
                                        <h4 className="text-sm font-semibold text-foreground">Payment History</h4>
                                      </div>
                                      {history.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No payment records yet.</p>
                                      ) : (
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-sm">
                                            <thead>
                                              <tr className="text-muted-foreground">
                                                <th className="text-left p-2 font-medium">Period</th>
                                                <th className="text-right p-2 font-medium">Base</th>
                                                <th className="text-right p-2 font-medium">Bonus</th>
                                                <th className="text-right p-2 font-medium">Total</th>
                                                <th className="text-left p-2 font-medium">Status</th>
                                                <th className="text-left p-2 font-medium">Paid At</th>
                                                <th className="text-left p-2 font-medium">Note</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/30">
                                              {history.map(h => (
                                                <tr key={h.id}>
                                                  <td className="p-2 text-foreground">{monthNames[h.period_month]} {h.period_year}</td>
                                                  <td className="p-2 text-right text-foreground">${h.base_amount.toLocaleString()}</td>
                                                  <td className="p-2 text-right">
                                                    <span className={cn(h.bonus_amount > 0 ? "text-success" : "text-muted-foreground")}>
                                                      {h.bonus_amount > 0 ? `+$${h.bonus_amount.toLocaleString()}` : '-'}
                                                    </span>
                                                  </td>
                                                  <td className="p-2 text-right font-semibold text-foreground">${h.total_amount.toLocaleString()}</td>
                                                  <td className="p-2">
                                                    <Badge variant="secondary" className={cn(
                                                      "text-xs",
                                                      h.status === 'paid'
                                                        ? 'bg-success/10 text-success border border-success/20'
                                                        : 'bg-warning/10 text-warning border border-warning/20'
                                                    )}>
                                                      {h.status === 'paid' ? 'Paid' : 'Unpaid'}
                                                    </Badge>
                                                  </td>
                                                  <td className="p-2 text-muted-foreground">
                                                    {h.paid_at ? new Date(h.paid_at).toLocaleDateString() : '-'}
                                                  </td>
                                                  <td className="p-2 text-muted-foreground max-w-[150px] truncate">{h.note || '-'}</td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-muted/50">
                        <tr>
                          <td colSpan={7} className="p-4 font-semibold text-foreground">
                            Total Payroll This Month
                          </td>
                          <td className="p-4 text-right font-bold text-primary text-xl">
                            ${(totals.freelanceTotal + totals.salaryTotal).toLocaleString()}
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      <AddBonusModal
        open={bonusModalOpen}
        onOpenChange={setBonusModalOpen}
        editor={selectedEditor}
        onSuccess={fetchPayrollData}
      />
      <PayrollPaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        editor={selectedEditor}
        agencyId={agencyId}
        onSuccess={fetchPayrollData}
      />
      <AddBalanceModal
        open={balanceModalOpen}
        onOpenChange={setBalanceModalOpen}
        editor={selectedEditor}
        agencyId={agencyId}
        onSuccess={fetchPayrollData}
      />
      <MobileBottomNav role="admin" />
    </>
  );
};

export default AdminPayroll;
