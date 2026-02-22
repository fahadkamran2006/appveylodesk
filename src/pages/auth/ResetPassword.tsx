import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Command, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const passwordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidLink, setIsValidLink] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a recovery session from the URL hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    const accessToken = hashParams.get('access_token');

    if (type === 'recovery' && accessToken) {
      // Supabase will automatically set the session from the URL
      setIsValidLink(true);
    } else {
      // Also check if supabase already picked up the session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          setIsValidLink(false);
        }
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setIsLoading(false);

    if (error) {
      toast.error(error.message);
    } else {
      setSuccess(true);
      toast.success('Password updated successfully!');
      setTimeout(() => navigate('/auth/login'), 3000);
    }
  };

  if (!isValidLink) {
    return (
      <>
        <Helmet>
          <title>Invalid Link | Veylodesk</title>
        </Helmet>
        <div className="min-h-screen bg-background flex items-center justify-center px-6">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Invalid or Expired Link</h1>
            <p className="text-muted-foreground mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Button variant="hero" asChild>
              <Link to="/auth/forgot-password">Request New Link</Link>
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Reset Password | Veylodesk</title>
        <meta name="description" content="Set a new password for your Veylodesk account." />
      </Helmet>

      <div className="min-h-screen bg-background flex">
        <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-8">
          <div className="sm:mx-auto sm:w-full sm:max-w-md">
            <Link to="/auth/login" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </Link>

            <Link to="/" className="flex items-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Command className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-2xl font-bold text-foreground">
                Veylo<span className="text-gradient">desk</span>
              </span>
            </Link>

            {success ? (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Password Updated!</h1>
                <p className="text-muted-foreground">
                  Your password has been reset. Redirecting you to login...
                </p>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-foreground mb-2">Set new password</h1>
                <p className="text-muted-foreground mb-8">
                  Enter your new password below.
                </p>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <Label htmlFor="password">New Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="mt-1"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="mt-1"
                      required
                      disabled={isLoading}
                    />
                  </div>

                  <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>

        <div className="hidden lg:flex flex-1 bg-surface-dark items-center justify-center p-12">
          <div className="max-w-lg text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-primary flex items-center justify-center mx-auto mb-8 shadow-glow">
              <Command className="w-10 h-10 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-4">Almost There!</h2>
            <p className="text-muted-foreground">
              Choose a strong password to keep your account secure.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ResetPassword;
