import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PaymentMethod {
  id: string;
  agency_id: string;
  name: string;
  details: string;
  payment_link: string | null;
  is_default: boolean;
  created_at: string;
}

export const usePaymentMethods = () => {
  const { user } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMethods();
  }, [fetchMethods]);

  const getDefaultMethod = useCallback(() => {
    return methods.find((m) => m.is_default) || methods[0] || null;
  }, [methods]);

  return {
    methods,
    loading,
    refetch: fetchMethods,
    getDefaultMethod,
  };
};
