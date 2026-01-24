import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { DashboardLayout } from '@/components/DashboardLayout';
import { AvatarUpload } from '@/components/settings/AvatarUpload';
import { StorageManagement } from '@/components/settings/StorageManagement';
import { InstallPWAButton } from '@/components/InstallPWAButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings as SettingsIcon, User, Loader2, Smartphone, UserCircle } from 'lucide-react';

const profileSchema = z.object({
  full_name: z.string().min(1, 'Name is required'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const SettingsPage = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, updateProfile, uploadAvatar } = useProfile();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
    },
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth/login');
    }
  }, [user, authLoading, navigate]);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      form.reset({
        full_name: profile.full_name || '',
      });
    }
  }, [profile, form]);

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    try {
      await updateProfile({ full_name: data.full_name });
    } finally {
      setIsSaving(false);
    }
  };

  const getSidebarRole = (): 'admin' | 'client' | 'editor' => {
    switch (userRole) {
      case 'client':
        return 'client';
      case 'editor':
        return 'editor';
      default:
        return 'admin';
    }
  };

  const loading = authLoading || profileLoading;

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
        <meta name="description" content="Manage your profile and preferences." />
      </Helmet>

      <DashboardLayout role={getSidebarRole()}>
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6 md:mb-8">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Settings</h1>
              <p className="text-sm md:text-base text-muted-foreground">
                Manage your profile and preferences
              </p>
            </div>
          </div>

          {/* Missing Name Prompt */}
          {!loading && profile && !profile.full_name && (
            <Alert className="mb-6 border-primary/30 bg-primary/5">
              <UserCircle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                <span className="font-medium">Complete your profile!</span> Add your display name so teammates and clients can identify you in messages.
              </AlertDescription>
            </Alert>
          )}

          {/* Install App Card */}
          <Card className="glass-card border-border/50 mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Smartphone className="w-5 h-5" />
                Mobile App
              </CardTitle>
              <CardDescription>
                Install Veylodesk on your device for quick access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InstallPWAButton variant="default" />
            </CardContent>
          </Card>

          {/* Profile Card */}
          <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile
                </CardTitle>
                <CardDescription>
                  Update your personal information and profile photo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Upload */}
                <div className="flex justify-center py-4">
                  <AvatarUpload
                    currentUrl={profile?.avatar_url || null}
                    name={profile?.full_name || null}
                    onUpload={uploadAvatar}
                  />
                </div>

                <Separator />

                {/* Profile Form */}
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter your full name"
                              className="bg-surface-elevated border-border/50"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Email (read-only) */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">
                        Email
                      </label>
                      <Input
                        value={profile?.email || ''}
                        disabled
                        className="bg-surface-elevated border-border/50 opacity-60"
                      />
                      <p className="text-xs text-muted-foreground">
                        Email cannot be changed
                      </p>
                    </div>

                    <div className="pt-4">
                      <Button
                        type="submit"
                        className="w-full sm:w-auto"
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>

            {/* Storage Management - Admin Only */}
            {userRole === 'admin' && (
              <StorageManagement className="mt-6" />
            )}
          </div>
        </DashboardLayout>
      </>
    );
  };

export default SettingsPage;
