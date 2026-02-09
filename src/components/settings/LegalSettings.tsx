import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Scale, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LegalData {
  business_name: string;
  business_address: string;
  tax_id: string;
  invoice_footer: string;
}

interface LegalSettingsProps {
  className?: string;
}

export function LegalSettings({ className }: LegalSettingsProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [legalData, setLegalData] = useState<LegalData>({
    business_name: '',
    business_address: '',
    tax_id: '',
    invoice_footer: '',
  });

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
          .select('business_name, business_address, tax_id, invoice_footer')
          .eq('id', userRole.agency_id)
          .single();

        if (agency) {
          setLegalData({
            business_name: agency.business_name || '',
            business_address: agency.business_address || '',
            tax_id: agency.tax_id || '',
            invoice_footer: agency.invoice_footer || '',
          });
        }
      } catch (error) {
        console.error('Error fetching agency legal data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgencyData();
  }, [user]);

  const handleSave = async () => {
    if (!agencyId) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('agencies')
        .update({
          business_name: legalData.business_name || null,
          business_address: legalData.business_address || null,
          tax_id: legalData.tax_id || null,
          invoice_footer: legalData.invoice_footer || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agencyId);

      if (error) throw error;

      toast.success('Legal settings saved');
    } catch (error: any) {
      console.error('Error saving legal data:', error);
      toast.error(error.message || 'Failed to save legal settings');
    } finally {
      setIsSaving(false);
    }
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

  return (
    <Card className={cn("glass-card border-border/50", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="w-5 h-5" />
          Legal & Compliance
        </CardTitle>
        <CardDescription>
          Business details that appear on your invoices for legal compliance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Registered Business Name */}
        <div className="space-y-2">
          <Label htmlFor="business_name" className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            Registered Business Name
          </Label>
          <Input
            id="business_name"
            value={legalData.business_name}
            onChange={(e) => setLegalData(prev => ({ ...prev, business_name: e.target.value }))}
            placeholder="Your Company LLC"
            className="bg-surface-elevated border-border/50"
          />
          <p className="text-xs text-muted-foreground">
            Your official registered business name for invoices
          </p>
        </div>

        {/* Business Address */}
        <div className="space-y-2">
          <Label htmlFor="business_address">Business Address</Label>
          <Textarea
            id="business_address"
            value={legalData.business_address}
            onChange={(e) => setLegalData(prev => ({ ...prev, business_address: e.target.value }))}
            placeholder="123 Business Street&#10;Suite 100&#10;City, State 12345&#10;Country"
            className="bg-surface-elevated border-border/50 min-h-[100px]"
          />
          <p className="text-xs text-muted-foreground">
            Full business address for invoicing purposes
          </p>
        </div>

        {/* Tax/VAT ID */}
        <div className="space-y-2">
          <Label htmlFor="tax_id">Tax / VAT ID</Label>
          <Input
            id="tax_id"
            value={legalData.tax_id}
            onChange={(e) => setLegalData(prev => ({ ...prev, tax_id: e.target.value }))}
            placeholder="US12-3456789 or VAT123456789"
            className="bg-surface-elevated border-border/50"
          />
          <p className="text-xs text-muted-foreground">
            Your tax identification number (EIN, VAT, GST, etc.)
          </p>
        </div>

        {/* Invoice Footer Terms */}
        <div className="space-y-2">
          <Label htmlFor="invoice_footer">Invoice Footer Terms</Label>
          <Textarea
            id="invoice_footer"
            value={legalData.invoice_footer}
            onChange={(e) => setLegalData(prev => ({ ...prev, invoice_footer: e.target.value }))}
            placeholder="Payment is due within 30 days. Late payments may incur a 1.5% monthly fee. All sales are final."
            className="bg-surface-elevated border-border/50 min-h-[80px]"
          />
          <p className="text-xs text-muted-foreground">
            Legal disclaimers or terms displayed at the bottom of invoices
          </p>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full sm:w-auto"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Legal Settings'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
