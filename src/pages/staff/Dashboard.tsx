import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { StaffSidebar } from '@/components/StaffSidebar';
import { DashboardHeader } from '@/components/notifications/DashboardHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FolderKanban, Users, UsersRound, Receipt, DollarSign, HardDrive,
  MessageSquare, FileBarChart, CalendarCheck, Briefcase,
} from 'lucide-react';

interface Tile {
  label: string; href: string; icon: React.ElementType; permission?: string; description: string;
}

const tiles: Tile[] = [
  { label: 'Projects', href: '/admin/projects', icon: FolderKanban, permission: 'projects.view', description: 'View and manage projects' },
  { label: 'Clients', href: '/admin/clients', icon: Users, permission: 'clients.view', description: 'Client list and onboarding' },
  { label: 'Team', href: '/admin/team', icon: UsersRound, permission: 'team.view', description: 'Editors and team members' },
  { label: 'Invoices', href: '/admin/invoices', icon: Receipt, permission: 'invoices.view', description: 'Billing and invoices' },
  { label: 'Payroll', href: '/admin/payroll', icon: DollarSign, permission: 'payroll.view', description: 'Editor payments and balances' },
  { label: 'Attendance', href: '/admin/team', icon: CalendarCheck, permission: 'attendance.view', description: 'Attendance and leave' },
  { label: 'Storage', href: '/admin/storage', icon: HardDrive, permission: 'storage.view', description: 'Files and assets' },
  { label: 'Performance', href: '/admin/team', icon: FileBarChart, permission: 'performance.view', description: 'Editor performance' },
];

const StaffDashboard = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const { can } = usePermissions();

  useEffect(() => {
    if (!loading && !user) navigate('/auth/login');
    if (!loading && userRole && userRole !== 'staff') {
      navigate(userRole === 'admin' ? '/admin/dashboard' : userRole === 'client' ? '/client/dashboard' : '/editor/dashboard');
    }
  }, [user, userRole, loading, navigate]);

  const visible = tiles.filter((t) => !t.permission || can(t.permission));

  return (
    <>
      <Helmet>
        <title>Staff Dashboard | Veylodesk</title>
      </Helmet>
      <div className="min-h-screen bg-background flex flex-col md:flex-row">
        <div className="hidden md:block"><StaffSidebar /></div>
        <main className="flex-1 overflow-auto p-4 md:p-8 pb-20 md:pb-8">
          <DashboardHeader />
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Staff Workspace</h1>
              <p className="text-muted-foreground">Quick access to the areas you can manage</p>
            </div>
          </div>

          {visible.length === 0 ? (
            <Card className="glass-card border-border/50">
              <CardContent className="py-12 text-center text-muted-foreground">
                You don't have any permissions assigned yet. Please contact your admin.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((t) => (
                <Link key={t.label} to={t.href}>
                  <Card className="glass-card border-border/50 hover:border-primary/50 transition-all hover:shadow-lg cursor-pointer h-full">
                    <CardHeader>
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                        <t.icon className="w-5 h-5 text-primary" />
                      </div>
                      <CardTitle className="text-lg">{t.label}</CardTitle>
                      <CardDescription>{t.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default StaffDashboard;
