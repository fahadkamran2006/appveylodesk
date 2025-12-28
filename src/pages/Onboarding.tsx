import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Command, Loader2, Building2, Upload, Users } from 'lucide-react';
import { toast } from 'sonner';

type Step = 1 | 2 | 3;

const Onboarding = () => {
  const [step, setStep] = useState<Step>(1);
  const [agencyName, setAgencyName] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth/login');
      }
    });
  }, [navigate]);

  const handleComplete = async () => {
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

      // Update profile with agency_id and mark onboarding complete
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          agency_id: agency.id,
          onboarding_completed: true,
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast.success('Agency created! Welcome to Veylodesk.');
      navigate('/admin/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create agency');
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { number: 1, title: 'Agency Details', icon: Building2 },
    { number: 2, title: 'Team Size', icon: Users },
    { number: 3, title: 'Get Started', icon: Command },
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
          <div className="flex items-center justify-center gap-4 mb-12">
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
                    className={`w-16 h-0.5 mx-2 transition-colors ${
                      step > s.number ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="glass-card rounded-2xl p-8">
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
                    onClick={() => setStep(3)}
                    disabled={!teamSize}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
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
                    <strong className="text-foreground">Pro tip:</strong> Start by inviting your first client or editor from the dashboard.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button
                    variant="hero"
                    size="lg"
                    className="flex-1"
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
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Onboarding;
