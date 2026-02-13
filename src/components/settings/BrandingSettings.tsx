import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useBranding } from '@/contexts/BrandingContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Palette, Upload, Loader2, Lock, Command, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AgencyBrandingForm {
  logo_url: string;
  primary_color: string;
  agency_name: string;
  enabled: boolean;
}

const DEFAULT_BRANDING: AgencyBrandingForm = {
  logo_url: '',
  primary_color: '#6366f1',
  agency_name: '',
  enabled: false,
};

interface BrandingSettingsProps {
  className?: string;
}

export function BrandingSettings({ className }: BrandingSettingsProps) {
  const { user } = useAuth();
  const { refetch: refetchBranding } = useBranding();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [planTier, setPlanTier] = useState<string>('starter');
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState('');
  const [branding, setBranding] = useState<AgencyBrandingForm>({ ...DEFAULT_BRANDING });

  const canWhiteLabel = planTier === 'growth' || planTier === 'scale';

  useEffect(() => {
    const fetchAgencyData = async () => {
      if (!user) return;

      try {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('agency_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!userRole?.agency_id) return;

        setAgencyId(userRole.agency_id);

        const { data: agency } = await supabase
          .from('agencies')
          .select('plan_tier, branding, name')
          .eq('id', userRole.agency_id)
          .single();

        if (agency) {
          setPlanTier(agency.plan_tier || 'starter');
          setAgencyName(agency.name || '');
          const existingBranding = agency.branding as Record<string, any> | null;
          setBranding({
            logo_url: existingBranding?.logo_url || '',
            primary_color: existingBranding?.primary_color || '#6366f1',
            agency_name: existingBranding?.agency_name || agency.name || '',
            enabled: existingBranding?.enabled === true,
          });
        }
      } catch (error) {
        console.error('Error fetching agency data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgencyData();
  }, [user]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !agencyId) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `agency-logos/${agencyId}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setBranding(prev => ({
        ...prev,
        logo_url: `${urlData.publicUrl}?t=${Date.now()}`,
      }));

      toast.success('Logo uploaded successfully');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error(error.message || 'Failed to upload logo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!agencyId) return;

    setIsSaving(true);
    try {
      const brandingJson: Record<string, any> = {
        logo_url: branding.logo_url || null,
        primary_color: branding.primary_color || null,
        agency_name: branding.agency_name || null,
        enabled: branding.enabled,
      };

      const { error } = await supabase
        .from('agencies')
        .update({
          branding: brandingJson,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agencyId);

      if (error) throw error;

      toast.success('Branding settings saved');
      refetchBranding();
    } catch (error: any) {
      console.error('Error saving branding:', error);
      toast.error(error.message || 'Failed to save branding');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setBranding({
      logo_url: '',
      primary_color: '#6366f1',
      agency_name: agencyName || '',
      enabled: false,
    });
    toast.info('Branding reset to defaults. Click "Save Branding" to apply.');
  };

  if (isLoading) {
    return (
      <Card className={cn("glass-card border-border/50", className)}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!canWhiteLabel) {
    return (
      <Card className={cn("glass-card border-border/50", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            White-Label Branding
          </CardTitle>
          <CardDescription>
            Customize your agency's branding across the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="border-primary/30 bg-primary/5">
            <Lock className="h-4 w-4 text-primary" />
            <AlertDescription className="text-foreground">
              <span className="font-medium">Upgrade to Growth or Scale</span> to unlock white-label branding. 
              Replace Veylodesk branding with your own logo and agency name.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("glass-card border-border/50", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="w-5 h-5" />
          White-Label Branding
        </CardTitle>
        <CardDescription>
          Customize your agency's branding across the platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-surface-elevated">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Use Custom Branding</Label>
            <p className="text-sm text-muted-foreground">
              Replace Veylodesk branding with your own across all dashboards
            </p>
          </div>
          <Switch
            checked={branding.enabled}
            onCheckedChange={(checked) => setBranding(prev => ({ ...prev, enabled: checked }))}
          />
        </div>

        {/* Logo Upload */}
        <div className="space-y-3">
          <Label>Agency Logo</Label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-surface-elevated border border-border/50 flex items-center justify-center overflow-hidden">
              {branding.logo_url ? (
                <img 
                  src={branding.logo_url} 
                  alt="Agency logo" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <Command className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                  disabled={isUploading}
                />
                <Button variant="outline" disabled={isUploading} asChild>
                  <span>
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Logo
                      </>
                    )}
                  </span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: Square image, 200x200px or larger
              </p>
            </div>
          </div>
        </div>

        {/* Agency Name */}
        <div className="space-y-2">
          <Label htmlFor="agency_name">Agency Name</Label>
          <Input
            id="agency_name"
            value={branding.agency_name || ''}
            onChange={(e) => setBranding(prev => ({ ...prev, agency_name: e.target.value }))}
            placeholder="Your Agency Name"
            className="bg-surface-elevated border-border/50"
          />
          <p className="text-xs text-muted-foreground">
            Displayed in the sidebar and client portal
          </p>
        </div>

        {/* Primary Color */}
        <div className="space-y-2">
          <Label htmlFor="primary_color">Brand Color</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              id="primary_color"
              value={branding.primary_color || '#6366f1'}
              onChange={(e) => setBranding(prev => ({ ...prev, primary_color: e.target.value }))}
              className="w-12 h-10 rounded cursor-pointer border border-border/50"
            />
            <Input
              value={branding.primary_color || '#6366f1'}
              onChange={(e) => setBranding(prev => ({ ...prev, primary_color: e.target.value }))}
              placeholder="#6366f1"
              className="bg-surface-elevated border-border/50 w-32"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Used for accents across the platform
          </p>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <Label>Preview</Label>
          <div className="p-4 rounded-xl bg-surface-elevated border border-border/50">
            <div className="flex items-center gap-3">
              {branding.logo_url ? (
                <img 
                  src={branding.logo_url} 
                  alt="Preview" 
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Command className="w-5 h-5 text-primary-foreground" />
                </div>
              )}
              <span className="text-lg font-bold text-foreground">
                {branding.agency_name || 'Your Agency'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 sm:flex-none"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Branding'
            )}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
