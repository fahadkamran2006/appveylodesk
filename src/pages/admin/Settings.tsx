import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { AppSidebar } from '@/components/AppSidebar';
import { Settings } from 'lucide-react';

const AdminSettings = () => {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth/login');
    }
    if (!loading && userRole && userRole !== 'admin') {
      navigate(userRole === 'client' ? '/client/dashboard' : '/editor/dashboard');
    }
  }, [user, userRole, loading, navigate]);

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
        <title>Settings | Veylodesk</title>
        <meta name="description" content="Manage your agency settings." />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        <AppSidebar role="admin" />

        <main className="flex-1 p-8">
          <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <Settings className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Settings</h1>
            <p className="text-muted-foreground max-w-md">
              Your settings panel is coming soon. Configure your agency profile, 
              team permissions, and preferences here.
            </p>
          </div>
        </main>
      </div>
    </>
  );
};

export default AdminSettings;
