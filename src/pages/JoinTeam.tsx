import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const joinSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be less than 100 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72, 'Password must be less than 72 characters'),
});

interface InvitationData {
  id: string;
  email: string;
  agency_name: string;
  role: string;
  full_name: string | null;
}

const JoinTeam = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingInvite, setIsCheckingInvite] = useState(true);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'form' | 'success'>('form');

  const inviteToken = searchParams.get('invite');

  useEffect(() => {
    const checkInvite = async () => {
      if (!inviteToken) {
        setInviteError('No invitation token provided');
        setIsCheckingInvite(false);
        return;
      }

      // Validate UUID format to prevent injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(inviteToken)) {
        setInviteError('Invalid invitation token format');
        setIsCheckingInvite(false);
        return;
      }

      try {
        // Use secure RPC function instead of direct table access
        const { data, error } = await supabase.rpc('verify_invitation_token', {
          _token: inviteToken,
        });

        if (error) {
          console.error('Error verifying invitation:', error);
          setInviteError('Failed to verify invitation');
          setIsCheckingInvite(false);
          return;
        }

        const invitation = data?.[0];

        if (!invitation || !invitation.valid) {
          if (invitation?.already_accepted) {
            setInviteError('This invitation has already been accepted');
          } else {
            setInviteError('Invalid or expired invitation');
          }
          setIsCheckingInvite(false);
          return;
        }

        if (invitation.role !== 'editor' && invitation.role !== 'staff') {
          setInviteError('This invitation is not for a team member role');
          setIsCheckingInvite(false);
          return;
        }

        setInvitationData({
          id: inviteToken,
          email: invitation.email,
          agency_name: invitation.agency_name || 'the agency',
          role: invitation.role,
          full_name: invitation.full_name,
        });

        if (invitation.full_name) {
          setFullName(invitation.full_name);
        }
      } catch (err) {
        console.error('Error checking invitation:', err);
        setInviteError('Failed to verify invitation');
      } finally {
        setIsCheckingInvite(false);
      }
    };

    checkInvite();
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = joinSchema.safeParse({ fullName, password });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    if (!invitationData) {
      toast.error('No valid invitation found');
      return;
    }

    setIsLoading(true);

    try {
      // Create user account
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: invitationData.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${invitationData.role === 'staff' ? '/staff/dashboard' : '/editor/dashboard'}`,
          data: {
            full_name: fullName,
          },
        },
      });

      if (signUpError) {
        // If user already exists, try to sign them in
        if (signUpError.message.includes('already registered')) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: invitationData.email,
            password,
          });

          if (signInError) {
            throw signInError;
          }
        } else {
          throw signUpError;
        }
      }

      // Wait for session to be established
      await new Promise(resolve => setTimeout(resolve, 500));

      // Accept the invitation
      const { error: acceptError } = await supabase.rpc('accept_agency_invitation', {
        _token: invitationData.id,
      });

      if (acceptError) {
        console.error('Error accepting invitation:', acceptError);
        throw acceptError;
      }

      // Update profile with full name
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ 
            full_name: fullName,
            onboarding_completed: true,
          })
          .eq('id', user.id);
      }

      toast.success(`Welcome to ${invitationData.agency_name}!`);
      setStep('success');
    } catch (error: any) {
      console.error('Error joining:', error);
      toast.error(error.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    navigate(invitationData?.role === 'staff' ? '/staff/dashboard' : '/editor/dashboard');
  };

  if (isCheckingInvite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (inviteError) {
    return (
      <>
        <Helmet>
          <title>Invalid Invitation | Veylodesk</title>
        </Helmet>
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 rounded-2xl bg-destructive/20 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Invalid Invitation</h1>
            <p className="text-muted-foreground mb-6">{inviteError}</p>
            <Link to="/auth/login">
              <Button variant="outline">Go to Login</Button>
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Join {invitationData?.agency_name} Team | Veylodesk</title>
        <meta name="description" content={`Accept your invitation to join the ${invitationData?.agency_name} team on Veylodesk.`} />
      </Helmet>

      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="glass-card rounded-2xl p-8">
            {step === 'form' && (
              <>
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-6 shadow-glow">
                    <Users className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h1 className="text-2xl font-bold text-foreground mb-2">
                    Join the {invitationData?.agency_name} Team
                  </h1>
                  <p className="text-muted-foreground">
                    Create your account to start collaborating on projects
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={invitationData?.email || ''}
                      disabled
                      className="mt-1 bg-muted"
                    />
                  </div>

                  <div>
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Smith"
                      className="mt-1"
                      maxLength={100}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a password"
                      className="mt-1"
                      maxLength={72}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Must be at least 6 characters
                    </p>
                  </div>

                  <Button
                    type="submit"
                    variant="hero"
                    size="lg"
                    className="w-full mt-6"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Creating Account...
                      </>
                    ) : (
                      'Create Account & Join Team'
                    )}
                  </Button>
                </form>

                <p className="text-center text-sm text-muted-foreground mt-6">
                  Already have an account?{' '}
                  <Link to="/auth/login" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </>
            )}

            {step === 'success' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-6 shadow-glow">
                  <CheckCircle className="w-8 h-8 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Welcome to the team!
                </h1>
                <p className="text-muted-foreground mb-6">
                  Your account has been created. You can now access your assigned projects and start collaborating.
                </p>
                <Button
                  variant="hero"
                  size="lg"
                  className="w-full"
                  onClick={handleGoToDashboard}
                >
                  Go to Dashboard
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default JoinTeam;
