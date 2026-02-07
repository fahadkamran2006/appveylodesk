import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CreditCard, Plus, Pencil, Trash2, Star, Link as LinkIcon } from 'lucide-react';

interface PaymentMethod {
  id: string;
  name: string;
  details: string;
  payment_link: string | null;
  is_default: boolean;
  created_at: string;
}

export const PaymentMethodsSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDetails, setFormDetails] = useState('');
  const [formPaymentLink, setFormPaymentLink] = useState('');
  const [formIsDefault, setFormIsDefault] = useState(false);

  const fetchMethods = useCallback(async () => {
    if (!user) return;

    try {
      const { data: agencyId } = await supabase.rpc('get_user_agency_id', { _user_id: user.id });
      
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMethods(data || []);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      toast({
        title: 'Error loading payment methods',
        description: 'Please try refreshing the page.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const resetForm = () => {
    setFormName('');
    setFormDetails('');
    setFormPaymentLink('');
    setFormIsDefault(false);
    setSelectedMethod(null);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setFormName(method.name);
    setFormDetails(method.details);
    setFormPaymentLink(method.payment_link || '');
    setFormIsDefault(method.is_default);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formName || !formDetails) return;

    setSaving(true);
    try {
      const { data: agencyId } = await supabase.rpc('get_user_agency_id', { _user_id: user.id });

      // If setting as default, unset other defaults first
      if (formIsDefault) {
        await supabase
          .from('payment_methods')
          .update({ is_default: false })
          .eq('agency_id', agencyId);
      }

      if (selectedMethod) {
        // Update existing
        const { error } = await supabase
          .from('payment_methods')
          .update({
            name: formName,
            details: formDetails,
            payment_link: formPaymentLink || null,
            is_default: formIsDefault,
          })
          .eq('id', selectedMethod.id);

        if (error) throw error;
        toast({ title: 'Payment method updated' });
      } else {
        // Create new
        const { error } = await supabase.from('payment_methods').insert({
          agency_id: agencyId,
          name: formName,
          details: formDetails,
          payment_link: formPaymentLink || null,
          is_default: formIsDefault || methods.length === 0, // First one is default
        });

        if (error) throw error;
        toast({ title: 'Payment method created' });
      }

      setModalOpen(false);
      resetForm();
      fetchMethods();
    } catch (error: any) {
      console.error('Error saving payment method:', error);
      toast({
        title: 'Failed to save',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMethod) return;

    try {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', selectedMethod.id);

      if (error) throw error;

      toast({ title: 'Payment method deleted' });
      setDeleteDialogOpen(false);
      setSelectedMethod(null);
      fetchMethods();
    } catch (error: any) {
      console.error('Error deleting payment method:', error);
      toast({
        title: 'Failed to delete',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const confirmDelete = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <Card className="glass-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Methods
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass-card border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Payment Methods
              </CardTitle>
              <CardDescription>
                Create reusable payment profiles for your invoices (Bank Transfer, Crypto, PayPal, etc.)
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add Method
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {methods.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No payment methods configured yet.</p>
              <Button variant="link" onClick={openCreateModal} className="mt-2">
                Add your first payment method
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {methods.map((method) => (
                <div
                  key={method.id}
                  className="p-4 rounded-lg bg-muted/30 border border-border/50 flex items-start justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{method.name}</p>
                      {method.is_default && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
                          <Star className="w-3 h-3" />
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-2">
                      {method.details}
                    </p>
                    {method.payment_link && (
                      <div className="flex items-center gap-1 text-xs text-primary mt-1">
                        <LinkIcon className="w-3 h-3" />
                        <span className="truncate">{method.payment_link}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => openEditModal(method)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => confirmDelete(method)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedMethod ? 'Edit Payment Method' : 'Add Payment Method'}
            </DialogTitle>
            <DialogDescription>
              Create a reusable payment profile that can be attached to invoices.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label htmlFor="methodName">Method Name</Label>
              <Input
                id="methodName"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Bank Transfer, PayPal, Crypto"
                className="mt-2"
                required
              />
            </div>
            <div>
              <Label htmlFor="methodDetails">Payment Details</Label>
              <Textarea
                id="methodDetails"
                value={formDetails}
                onChange={(e) => setFormDetails(e.target.value)}
                placeholder="Enter payment instructions, IBAN, wallet address, etc."
                className="mt-2 min-h-[100px]"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                This will be displayed on invoices
              </p>
            </div>
            <div>
              <Label htmlFor="paymentLink">Payment Link (Optional)</Label>
              <Input
                id="paymentLink"
                type="url"
                value={formPaymentLink}
                onChange={(e) => setFormPaymentLink(e.target.value)}
                placeholder="https://pay.example.com/..."
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Direct payment URL for a "Pay Now" button
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isDefault">Set as Default</Label>
                <p className="text-xs text-muted-foreground">
                  Pre-selected when creating new invoices
                </p>
              </div>
              <Switch
                id="isDefault"
                checked={formIsDefault}
                onCheckedChange={setFormIsDefault}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !formName || !formDetails}>
                {saving ? 'Saving...' : selectedMethod ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedMethod?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
