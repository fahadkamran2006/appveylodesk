import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { openPaddleCheckout } from '@/hooks/useSubscription';
import { Command, Loader2, Building2, Users, UserPlus, Plus, X, Mail } from 'lucide-react';
import { toast } from 'sonner';

type Step = 1 | 2 | 3 | 4;
type InviteRole = 'editor' | 'client';

interface TeamInvite {
  id: string;
  email: string;
  role: InviteRole;
}

const Onboarding = () => {
  const [step, setStep] = useState<Step>(1);
  const [agencyName, setAgencyName] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([
    { id: crypto.randomUUID(), email: '', role: 'editor' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingInvites, setIsSendingInvites] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth/login');
        return;
      }

      // Check if user already has a role (existing user signing in via OAuth)
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (roleData?.role) {
        // Existing user — redirect to their dashboard
        const dashMap: Record<string, string> = { admin: '/admin/dashboard', client: '/client/dashboard', editor: '/editor/dashboard' };
        navigate(dashMap[roleData.role] || '/admin/dashboard', { replace: true });
        return;
      }

      // Check if user already has an agency (skip onboarding)
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id, onboarding_completed')
        .eq('id', session.user.id)
        .single();

      if (profile?.onboarding_completed && profile?.agency_id) {
        navigate('/admin/dashboard', { replace: true });
        return;
      }

      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [navigate]);

  // Show a branded loading screen while verifying auth status
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <Helmet><title>Loading | Veylodesk</title></Helmet>
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center">
              <Command className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground">Veylodesk</span>
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const addInvite = () => {
    setTeamInvites([...teamInvites, { id: crypto.randomUUID(), email: '', role: 'editor' }]);
  };

  const removeInvite = (id: string) => {
    if (teamInvites.length > 1) {
      setTeamInvites(teamInvites.filter(invite => invite.id !== id));
    }
  };

  const updateInvite = (id: string, field: 'email' | 'role', value: string) => {
    setTeamInvites(teamInvites.map(invite => 
      invite.id === id ? { ...invite, [field]: value } : invite
    ));
  };

  const handleCreateAgency = async () => {
    if (!agencyName.trim()) {
      toast.error('Please enter your agency name');
      return;
    }

    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create agency
      const { data: agency, error: agencyError } = await supabase
        .from('agencies')
        .insert({ name: agencyName })
        .select()
        .single();

      if (agencyError) throw agencyError;

      // Create user role as admin
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          agency_id: agency.id,
          role: 'admin',
        });

      if (roleError) throw roleError;

      // Update profile with agency_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          agency_id: agency.id,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Move to invite step
      setStep(3);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create agency');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendInvites = async () => {
    const validInvites = teamInvites.filter(invite => invite.email.trim() !== '');
    
    if (validInvites.length === 0) {
      toast.error('Please enter at least one email address');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = validInvites.filter(invite => !emailRegex.test(invite.email));
    if (invalidEmails.length > 0) {
      toast.error('Please enter valid email addresses');
      return;
    }

    setIsSendingInvites(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user's agency_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (!profile?.agency_id) throw new Error('Agency not found');

      // Create invitation records for invited users
      for (const invite of validInvites) {
        const { data: invitation, error: inviteError } = await supabase
          .from('agency_invitations')
          .insert({
            agency_id: profile.agency_id,
            email: invite.email.toLowerCase().trim(),
            full_name: null,
            role: invite.role,
            invited_by: user.id,
          })
          .select('id')
          .single();

        if (inviteError) {
          throw inviteError;
        }

        // Send invite email via edge function
        await supabase.functions.invoke('send-invite-email', {
          body: {
            invitationId: invitation.id,
            email: invite.email.toLowerCase().trim(),
            role: invite.role,
            agencyName: agencyName,
          },
        });
      }

      toast.success(`Invited ${validInvites.length} team member${validInvites.length > 1 ? 's' : ''}!`);
      setStep(4);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send invites');
    } finally {
      setIsSendingInvites(false);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get user's agency_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('agency_id')
        .eq('id', user.id)
        .single();

      if (!profile?.agency_id) throw new Error('Agency not found');

      // Mark onboarding complete
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast.success('Welcome to Veylodesk!');

      // Check for pre-selected plan from signup flow
      const selectedPlan = localStorage.getItem('selected_plan') as 'free' | 'starter' | 'growth' | 'scale' | null;
      const selectedInterval = (localStorage.getItem('selected_interval') as 'monthly' | 'yearly') || 'yearly';

      // Clear stored plan values
      localStorage.removeItem('selected_plan');
      localStorage.removeItem('selected_interval');

      // Navigate to dashboard first
      navigate('/admin/dashboard');

      // Only open Paddle checkout if a paid plan was explicitly selected.
      // Free plan (or no selection) stays on the Free tier — no auto-checkout.
      if (selectedPlan && ['starter', 'growth', 'scale'].includes(selectedPlan)) {
        setTimeout(() => {
          openPaddleCheckout(selectedPlan as 'starter' | 'growth' | 'scale', selectedInterval, profile.agency_id, user?.email);
        }, 500);
      }

    } catch (error: any) {
      toast.error(error.message || 'Failed to complete onboarding');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipInvites = async () => {
    setStep(4);
  };

  const steps = [
    { number: 1, title: 'Agency Details', icon: Building2 },
    { number: 2, title: 'Team Size', icon: Users },
    { number: 3, title: 'Invite Team', icon: UserPlus },
    { number: 4, title: 'Get Started', icon: Command },
  ];

  return (
    <>
      <Helmet>
        <title>Setup Your Agency | Veylodesk</title>
        <meta name="description" content="Complete your agency setup to start using Veylodesk." />
      </Helmet>

      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          {/* Progress Steps */}
          <div className="flex items-center justify-center gap-2 mb-12">
            {steps.map((s, i) => (
              <div key={s.number} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                    step >= s.number
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <s.icon className="w-5 h-5" />
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-1 transition-colors ${
                      step > s.number ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="glass-card rounded-2xl p-8">
            {/* Step 1: Agency Name */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-foreground mb-2">What's your agency name?</h1>
                  <p className="text-muted-foreground">This will be displayed on your client portals.</p>
                </div>

                <div>
                  <Label htmlFor="agencyName">Agency Name</Label>
                  <Input
                    id="agencyName"
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Awesome Video Studios"
                    className="mt-1"
                  />
                </div>

                <Button
                  variant="hero"
                  size="lg"
                  className="w-full"
                  onClick={() => setStep(2)}
                  disabled={!agencyName.trim()}
                >
                  Continue
                </Button>
              </div>
            )}

            {/* Step 2: Team Size */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-foreground mb-2">How big is your team?</h1>
                  <p className="text-muted-foreground">This helps us tailor your experience.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {['Just me', '2-5', '6-15', '15+'].map((size) => (
                    <button
                      key={size}
                      onClick={() => setTeamSize(size)}
                      className={`p-4 rounded-xl border transition-colors ${
                        teamSize === size
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      <span className="text-lg font-medium">{size}</span>
                      <span className="block text-sm opacity-70">
                        {size === 'Just me' ? 'Solo operator' : 'team members'}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button
                    variant="hero"
                    size="lg"
                    className="flex-1"
                    onClick={handleCreateAgency}
                    disabled={!teamSize || isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Continue'
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Invite Team */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold text-foreground mb-2">Invite your team</h1>
                  <p className="text-muted-foreground">Add editors and clients to your agency.</p>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {teamInvites.map((invite) => (
                    <div key={invite.id} className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="email"
                            value={invite.email}
                            onChange={(e) => updateInvite(invite.id, 'email', e.target.value)}
                            placeholder="colleague@email.com"
                            className="pl-10"
                          />
                        </div>
                      </div>
                      <Select
                        value={invite.role}
                        onValueChange={(value) => updateInvite(invite.id, 'role', value as InviteRole)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeInvite(invite.id)}
                        disabled={teamInvites.length === 1}
                        className="shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={addInvite}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Another
                </Button>

                <div className="flex gap-3 pt-2">
                  <Button 
                    variant="ghost" 
                    size="lg" 
                    className="flex-1"
                    onClick={handleSkipInvites}
                  >
                    Skip for Now
                  </Button>
                  <Button
                    variant="hero"
                    size="lg"
                    className="flex-1"
                    onClick={handleSendInvites}
                    disabled={isSendingInvites}
                  >
                    {isSendingInvites ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Invites'
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Get Started */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-6 shadow-glow">
                    <Command className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h1 className="text-2xl font-bold text-foreground mb-2">You're all set!</h1>
                  <p className="text-muted-foreground">
                    Welcome to Veylodesk, <strong>{agencyName}</strong>. Let's activate your account.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Next step:</strong> Complete payment to unlock your dashboard.
                  </p>
                </div>

                <Button
                  variant="hero"
                  size="lg"
                  className="w-full"
                  onClick={handleComplete}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Setting up...
                    </>
                  ) : (
                    'Finalize Setup & Pay'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Onboarding;
