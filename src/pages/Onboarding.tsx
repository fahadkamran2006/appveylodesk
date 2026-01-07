import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Command, Loader2, Building2, Users, UserPlus, Plus, X, Mail, UserCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

type Step = 1 | 2 | 3 | 4;
type InviteStep = 1 | 2; // 1 = Profile setup, 2 = Complete
type InviteRole = 'editor' | 'client';

interface TeamInvite {
  id: string;
  email: string;
  role: InviteRole;
}

interface InvitationData {
  agency_id: string;
  agency_name: string;
  role: 'admin' | 'client' | 'editor';
}

const Onboarding = () => {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [inviteStep, setInviteStep] = useState<InviteStep>(1);
  const [agencyName, setAgencyName] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [fullName, setFullName] = useState('');
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([
    { id: crypto.randomUUID(), email: '', role: 'editor' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingInvites, setIsSendingInvites] = useState(false);
  const [isInviteFlow, setIsInviteFlow] = useState(false);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth/login');
        return;
      }

      // Check for invite token in URL or localStorage
      const urlToken = searchParams.get('invite');
      const storedToken = localStorage.getItem('pending_invite_token');
      const token = urlToken || storedToken;

      if (token) {
        setInviteToken(token);
        setIsInviteFlow(true);
        
        // Store token if from URL
        if (urlToken) {
          localStorage.setItem('pending_invite_token', urlToken);
        }

        // Fetch invitation details for display
        const { data: invitation, error } = await supabase
          .from('agency_invitations')
          .select('agency_id, role')
          .eq('id', token)
          .maybeSingle();

        if (invitation && !error) {
          // Get agency name
          const { data: agency } = await supabase
            .from('agencies')
            .select('name')
            .eq('id', invitation.agency_id)
            .single();

          setInvitationData({
            agency_id: invitation.agency_id,
            agency_name: agency?.name || 'the agency',
            role: invitation.role as 'admin' | 'client' | 'editor',
          });

          // Pre-fill name from user metadata
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.user_metadata?.full_name) {
            setFullName(user.user_metadata.full_name);
          }
        } else {
          // Invalid token, clear it and show normal onboarding
          localStorage.removeItem('pending_invite_token');
          setIsInviteFlow(false);
          toast.error('Invalid or expired invitation');
        }
      }
    };

    init();
  }, [navigate, searchParams]);

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

  // Handle accepting invitation and joining agency
  const handleAcceptInvite = async () => {
    if (!inviteToken || !invitationData) {
      toast.error('No valid invitation found');
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Update profile with full name first
      if (fullName.trim()) {
        await supabase
          .from('profiles')
          .update({ full_name: fullName.trim() })
          .eq('id', user.id);
      }

      // Accept the invitation using the RPC function
      const { data, error: acceptError } = await supabase.rpc('accept_agency_invitation', {
        _token: inviteToken,
      });

      if (acceptError) {
        throw acceptError;
      }

      // Clear the stored token
      localStorage.removeItem('pending_invite_token');

      // Mark onboarding as complete
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      toast.success(`Welcome to ${invitationData.agency_name}!`);
      
      // Move to completion step
      setInviteStep(2);
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      toast.error(error.message || 'Failed to accept invitation');
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect based on role after invite acceptance
  const handleInviteComplete = () => {
    if (!invitationData) return;

    switch (invitationData.role) {
      case 'admin':
        navigate('/admin/dashboard');
        break;
      case 'client':
        navigate('/client/dashboard');
        break;
      case 'editor':
        navigate('/editor/dashboard');
        break;
      default:
        navigate('/');
    }
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

      // Mark onboarding complete
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast.success('Welcome to Veylodesk!');
      navigate('/admin/dashboard');
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

  const inviteSteps = [
    { number: 1, title: 'Your Profile', icon: UserCircle },
    { number: 2, title: 'Get Started', icon: CheckCircle },
  ];

  // Render Invite Flow (simplified onboarding for invited users)
  if (isInviteFlow && invitationData) {
    return (
      <>
        <Helmet>
          <title>Join {invitationData.agency_name} | Veylodesk</title>
          <meta name="description" content={`Accept your invitation to join ${invitationData.agency_name} on Veylodesk.`} />
        </Helmet>

        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            {/* Progress Steps */}
            <div className="flex items-center justify-center gap-2 mb-12">
              {inviteSteps.map((s, i) => (
                <div key={s.number} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      inviteStep >= s.number
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <s.icon className="w-5 h-5" />
                  </div>
                  {i < inviteSteps.length - 1 && (
                    <div
                      className={`w-16 h-0.5 mx-1 transition-colors ${
                        inviteStep > s.number ? 'bg-primary' : 'bg-muted'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="glass-card rounded-2xl p-8">
              {/* Invite Step 1: Profile Setup */}
              {inviteStep === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-6 shadow-glow">
                      <UserCircle className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">
                      Join {invitationData.agency_name}
                    </h1>
                    <p className="text-muted-foreground">
                      You've been invited as a <span className="text-primary font-medium capitalize">{invitationData.role}</span>
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="fullName">Your Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="John Smith"
                      className="mt-1"
                    />
                  </div>

                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full"
                    onClick={handleAcceptInvite}
                    disabled={isLoading || !fullName.trim()}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      'Accept Invitation'
                    )}
                  </Button>
                </div>
              )}

              {/* Invite Step 2: Complete */}
              {inviteStep === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-6 shadow-glow">
                      <CheckCircle className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">You're all set!</h1>
                    <p className="text-muted-foreground">
                      Welcome to <strong>{invitationData.agency_name}</strong>. 
                      {invitationData.role === 'client' && ' You can now view your projects and communicate with the team.'}
                      {invitationData.role === 'editor' && ' You can now access assigned projects and collaborate with the team.'}
                      {invitationData.role === 'admin' && ' You have full admin access to the agency.'}
                    </p>
                  </div>

                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full"
                    onClick={handleInviteComplete}
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
  }

  // Render Normal Agency Creation Flow
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
                  {teamInvites.map((invite, index) => (
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
                    Welcome to Veylodesk, <strong>{agencyName}</strong>. Let's take command.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Pro tip:</strong> Start by creating your first project from the dashboard.
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
                    'Launch Dashboard'
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