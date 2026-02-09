import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { CollapsibleSidebar } from '@/components/CollapsibleSidebar';
import { Button } from '@/components/ui/button';
import { AddBonusModal } from '@/components/admin/AddBonusModal';
import { supabase } from '@/integrations/supabase/client';
import { 
  DollarSign, 
  Users, 
  Briefcase, 
  Gift,
  Loader2,
  TrendingUp,
  Clock
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
}

const AdminPayroll = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [editors, setEditors] = useState<EditorPayroll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [bonusModalOpen, setBonusModalOpen] = useState(false);
  const [selectedEditor, setSelectedEditor] = useState<EditorPayroll | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'admin') {
      navigate(userRole === 'client' ? '/client/dashboard' : '/editor/dashboard');
    }
  }, [user, userRole, loading, navigate]);

  const fetchPayrollData = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Get user's agency_id
      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('agency_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!userRoleData?.agency_id) {
        setIsLoading(false);
        return;
      }

      const agencyId = userRoleData.agency_id;

      // Get all editors in agency
      const { data: editorRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('agency_id', agencyId)
        .eq('role', 'editor');

      if (!editorRoles || editorRoles.length === 0) {
        setEditors([]);
        setIsLoading(false);
        return;
      }

      const editorIds = editorRoles.map(r => r.user_id);

      // Get editor profiles with compensation data
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, employment_type, monthly_salary, accumulated_bonus')
        .in('id', editorIds);

      // Get freelance earnings (completed videos this month)
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

      // Calculate earnings per editor
      const earningsMap = new Map<string, { freelanceEarnings: number; completedVideos: number }>();
      
      (projectEditors || []).forEach(pe => {
        const project = pe.project as any;
        if (!project) return;
        
        const editorId = pe.editor_id;
        const current = earningsMap.get(editorId) || { freelanceEarnings: 0, completedVideos: 0 };
        
        // Count completed videos this month
        if (project.status === 'done' && project.completed_at) {
          const completedDate = new Date(project.completed_at);
          if (completedDate >= startOfMonth) {
            current.freelanceEarnings += project.editor_rate || 0;
            current.completedVideos += 1;
          }
        }
        
        earningsMap.set(editorId, current);
      });

      // Combine data
      const payrollData: EditorPayroll[] = (profiles || []).map(profile => {
        const earnings = earningsMap.get(profile.id) || { freelanceEarnings: 0, completedVideos: 0 };
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

  // Calculate totals
  const totals = useMemo(() => {
    const freelancers = editors.filter(e => e.employment_type === 'freelance');
    const salaried = editors.filter(e => e.employment_type === 'salaried');

    return {
      freelancerCount: freelancers.length,
      salariedCount: salaried.length,
      freelanceTotal: freelancers.reduce((sum, e) => sum + e.freelance_earnings, 0),
      salaryTotal: salaried.reduce((sum, e) => sum + (e.monthly_salary || 0) + e.accumulated_bonus, 0),
      bonusTotal: salaried.reduce((sum, e) => sum + e.accumulated_bonus, 0),
    };
  }, [editors]);

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

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
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Payroll</h1>
            <p className="text-muted-foreground mt-1">
              Manage editor compensation and bonuses
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="glass-card rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Freelancers</p>
                      <p className="text-2xl font-bold text-foreground">{totals.freelancerCount}</p>
                    </div>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-secondary-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Salaried Staff</p>
                      <p className="text-2xl font-bold text-foreground">{totals.salariedCount}</p>
                    </div>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Freelance Payouts</p>
                      <p className="text-2xl font-bold text-foreground">${totals.freelanceTotal.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Salary + Bonuses</p>
                      <p className="text-2xl font-bold text-foreground">${totals.salaryTotal.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editors Table */}
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
                          <th className="text-right p-4 text-sm font-medium text-muted-foreground">Base Pay</th>
                          <th className="text-right p-4 text-sm font-medium text-muted-foreground">Bonus</th>
                          <th className="text-right p-4 text-sm font-medium text-muted-foreground">Total</th>
                          <th className="text-right p-4 text-sm font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {editors.map((editor) => {
                          const isSalaried = editor.employment_type === 'salaried';
                          const basePay = isSalaried 
                            ? (editor.monthly_salary || 0)
                            : editor.freelance_earnings;
                          const bonus = isSalaried ? editor.accumulated_bonus : 0;
                          const total = basePay + bonus;

                          return (
                            <tr key={editor.id} className="hover:bg-muted/20">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-10 h-10">
                                    <AvatarImage src={editor.avatar_url || undefined} />
                                    <AvatarFallback className="bg-primary/20 text-primary">
                                      {getInitials(editor.full_name, editor.email)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-foreground">
                                      {editor.full_name || 'Unnamed'}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{editor.email}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4">
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    isSalaried
                                      ? 'bg-primary/10 text-primary border border-primary/20'
                                      : 'bg-muted text-muted-foreground'
                                  )}
                                >
                                  {isSalaried ? 'Salaried' : 'Freelance'}
                                </Badge>
                                {!isSalaried && editor.completed_videos > 0 && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {editor.completed_videos} videos
                                  </span>
                                )}
                              </td>
                              <td className="p-4 text-right font-medium text-foreground">
                                ${basePay.toLocaleString()}
                              </td>
                              <td className="p-4 text-right">
                                {isSalaried ? (
                                  <span className={cn(
                                    "font-medium",
                                    bonus > 0 ? "text-success" : "text-muted-foreground"
                                  )}>
                                    {bonus > 0 ? `+$${bonus.toLocaleString()}` : '-'}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <span className="font-bold text-foreground text-lg">
                                  ${total.toLocaleString()}
                                </span>
                              </td>
                              <td className="p-4 text-right">
                                {isSalaried && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAddBonus(editor)}
                                    className="gap-1"
                                  >
                                    <Gift className="w-4 h-4" />
                                    Add Bonus
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-muted/50">
                        <tr>
                          <td colSpan={4} className="p-4 font-semibold text-foreground">
                            Total Payroll This Month
                          </td>
                          <td className="p-4 text-right font-bold text-primary text-xl">
                            ${(totals.freelanceTotal + totals.salaryTotal).toLocaleString()}
                          </td>
                          <td></td>
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

      {/* Add Bonus Modal */}
      <AddBonusModal
        open={bonusModalOpen}
        onOpenChange={setBonusModalOpen}
        editor={selectedEditor}
        onSuccess={fetchPayrollData}
      />
    </>
  );
};

export default AdminPayroll;
