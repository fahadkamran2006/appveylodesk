import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { DollarSign, CheckCircle2, Clock, TrendingUp, Briefcase, Gift, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

import type { Database } from '@/integrations/supabase/types';

type ProjectStatus = Database['public']['Enums']['project_status'];
type EmploymentType = Database['public']['Enums']['employment_type'];

interface ProjectEarning {
  id: string;
  title: string;
  status: ProjectStatus;
  editor_rate: number | null;
}

interface EditorProfile {
  employment_type: EmploymentType;
  monthly_salary: number | null;
  accumulated_bonus: number;
}

interface PaymentRecord {
  id: string;
  period_month: number;
  period_year: number;
  base_amount: number;
  bonus_amount: number;
  total_amount: number;
  status: string;
  paid_at: string | null;
  note: string | null;
}

interface BalanceItem {
  id: string;
  label: string;
  amount: number;
  type: string;
  note: string | null;
}

const EditorEarnings = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [projects, setProjects] = useState<ProjectEarning[]>([]);
  const [profile, setProfile] = useState<EditorProfile | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'editor' && userRole !== 'admin') {
      navigate('/client/dashboard');
    }
  }, [user, userRole, loading, navigate]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    try {
      // Fetch profile (employment_type) and compensation separately (RLS-protected)
      const [{ data: profileBase }, { data: compRow }] = await Promise.all([
        supabase.from('profiles').select('employment_type').eq('id', user.id).maybeSingle(),
        (supabase as any).from('employee_compensation').select('monthly_salary, accumulated_bonus').eq('user_id', user.id).maybeSingle(),
      ]);

      setProfile({
        employment_type: (profileBase as any)?.employment_type ?? null,
        monthly_salary: (compRow as any)?.monthly_salary ?? null,
        accumulated_bonus: (compRow as any)?.accumulated_bonus ?? 0,
      } as EditorProfile);

      // Fetch projects
      const { data: projectData, error } = await supabase
        .from('project_editors')
        .select(`
          project:projects(
            id,
            title,
            status,
            editor_rate
          )
        `)
        .eq('editor_id', user.id);

      if (error) throw error;

      const projectsData: ProjectEarning[] = (projectData || [])
        .map(pe => pe.project)
        .filter((p): p is NonNullable<typeof p> => p !== null);
      
      setProjects(projectsData);

      // Fetch payment history
      const { data: paymentData } = await supabase
        .from('payroll_payments')
        .select('*')
        .eq('editor_id', user.id)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

      setPayments((paymentData || []) as PaymentRecord[]);

      // Fetch balances (company owes)
      const { data: balanceData } = await supabase
        .from('editor_balances')
        .select('*')
        .eq('editor_id', user.id)
        .order('created_at', { ascending: false });

      setBalances((balanceData || []) as BalanceItem[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error loading earnings",
        description: "Please try refreshing the page.",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (user && (userRole === 'editor' || userRole === 'admin')) {
      fetchData();
    }
  }, [user, userRole, fetchData]);

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; className: string }> = {
      backlog: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
      in_progress: { label: 'In Progress', className: 'bg-primary/10 text-primary border border-primary/20' },
      review: { label: 'In Review', className: 'bg-warning/10 text-warning border border-warning/20' },
      done: { label: 'Completed', className: 'bg-success/10 text-success border border-success/20' },
    };
    return statusMap[status] || { label: status, className: 'bg-muted text-muted-foreground' };
  };

  const isSalaried = profile?.employment_type === 'salaried';

  const completedProjects = projects.filter(p => p.status === 'done');
  const inProgressProjects = projects.filter(p => p.status !== 'done');
  
  const freelanceStats = {
    totalEarned: completedProjects.reduce((sum, p) => sum + (p.editor_rate || 0), 0),
    pendingEarnings: inProgressProjects.reduce((sum, p) => sum + (p.editor_rate || 0), 0),
    completedCount: completedProjects.length,
    inProgressCount: inProgressProjects.length,
  };

  const totalOwed = balances
    .filter(b => b.type === 'owed')
    .reduce((sum, b) => sum + b.amount, 0);
  const totalDeductions = balances
    .filter(b => b.type === 'deduction')
    .reduce((sum, b) => sum + b.amount, 0);

  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (loading || loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>My Earnings | Veylodesk</title>
        <meta name="description" content="View your project earnings." />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        <div className="hidden md:block">
          <CollapsibleSidebar role="editor" />
        </div>
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">My Earnings</h1>
            <p className="text-muted-foreground">
              {isSalaried ? 'Track your salary, bonuses, and payment history.' : 'Track your project payments and earnings.'}
            </p>
          </div>

          {/* Stats Cards */}
          {isSalaried ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Briefcase className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Salary</p>
                    <p className="text-2xl font-bold text-foreground">${(profile?.monthly_salary || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                    <Gift className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Accumulated Bonus</p>
                    <p className="text-2xl font-bold text-foreground">${(profile?.accumulated_bonus || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Company Owes</p>
                    <p className="text-2xl font-bold text-foreground">${(totalOwed - totalDeductions).toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payments Received</p>
                    <p className="text-2xl font-bold text-foreground">{payments.filter(p => p.status === 'paid').length}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Earned</p>
                    <p className="text-2xl font-bold text-foreground">${freelanceStats.totalEarned.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Pending</p>
                    <p className="text-2xl font-bold text-foreground">${freelanceStats.pendingEarnings.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completed Jobs</p>
                    <p className="text-2xl font-bold text-foreground">{freelanceStats.completedCount}</p>
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <DollarSign className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Jobs</p>
                    <p className="text-2xl font-bold text-foreground">{freelanceStats.inProgressCount}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment History (salaried) */}
          {isSalaried && payments.length > 0 && (
            <div className="glass-card rounded-xl overflow-hidden mb-8">
              <div className="p-6 border-b border-border/50">
                <h2 className="text-lg font-semibold text-foreground">Payment History</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Period</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">Base</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">Bonus</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">Total</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {payments.map((payment) => (
                      <tr key={payment.id} className="hover:bg-muted/20">
                        <td className="p-4 font-medium text-foreground">
                          {monthNames[payment.period_month]} {payment.period_year}
                        </td>
                        <td className="p-4 text-right text-foreground">${payment.base_amount.toLocaleString()}</td>
                        <td className="p-4 text-right">
                          <span className={cn(payment.bonus_amount > 0 ? "text-success" : "text-muted-foreground")}>
                            {payment.bonus_amount > 0 ? `+$${payment.bonus_amount.toLocaleString()}` : '-'}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold text-foreground">${payment.total_amount.toLocaleString()}</td>
                        <td className="p-4">
                          <Badge variant="secondary" className={cn(
                            payment.status === 'paid'
                              ? 'bg-success/10 text-success border border-success/20'
                              : 'bg-warning/10 text-warning border border-warning/20'
                          )}>
                            {payment.status === 'paid' ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Company Owes / Balances */}
          {isSalaried && balances.length > 0 && (
            <div className="glass-card rounded-xl overflow-hidden mb-8">
              <div className="p-6 border-b border-border/50">
                <h2 className="text-lg font-semibold text-foreground">Company Balances</h2>
                <p className="text-sm text-muted-foreground">Security funds, advances, and other balances</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Label</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Type</th>
                      <th className="text-right p-4 text-sm font-medium text-muted-foreground">Amount</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {balances.map((b) => (
                      <tr key={b.id} className="hover:bg-muted/20">
                        <td className="p-4 font-medium text-foreground">{b.label}</td>
                        <td className="p-4">
                          <Badge variant="secondary" className={cn(
                            b.type === 'owed'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'bg-destructive/10 text-destructive border border-destructive/20'
                          )}>
                            {b.type === 'owed' ? 'Company Owes' : 'Deduction'}
                          </Badge>
                        </td>
                        <td className="p-4 text-right font-bold text-foreground">${b.amount.toLocaleString()}</td>
                        <td className="p-4 text-sm text-muted-foreground">{b.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/50">
                    <tr>
                      <td colSpan={2} className="p-4 font-semibold text-foreground">Net Balance (Company Owes You)</td>
                      <td className="p-4 text-right font-bold text-primary text-lg">${(totalOwed - totalDeductions).toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Projects List (always shown) */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-6">All Projects</h2>
            
            {projects.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No projects assigned yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Project</th>
                      <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                      {!isSalaried && (
                        <th className="text-right p-4 text-sm font-medium text-muted-foreground">My Rate</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {projects.map((project) => {
                      const statusInfo = getStatusInfo(project.status);
                      return (
                        <tr key={project.id} className="hover:bg-muted/20">
                          <td className="p-4 font-medium text-foreground">
                            {project.title}
                          </td>
                          <td className="p-4">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium",
                              statusInfo.className
                            )}>
                              {statusInfo.label}
                            </span>
                          </td>
                          {!isSalaried && (
                            <td className="p-4 text-right">
                              <span className={cn(
                                "font-semibold",
                                project.status === 'done' ? "text-success" : "text-foreground"
                              )}>
                                {project.editor_rate 
                                  ? `$${project.editor_rate.toLocaleString()}` 
                                  : '-'
                                }
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  {!isSalaried && (
                    <tfoot className="bg-muted/50">
                      <tr>
                        <td colSpan={2} className="p-4 font-semibold text-foreground">
                          Total Earned (Completed)
                        </td>
                        <td className="p-4 text-right font-bold text-success text-lg">
                          ${freelanceStats.totalEarned.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
      <MobileBottomNav role="editor" />
    </>
  );
};

export default EditorEarnings;
