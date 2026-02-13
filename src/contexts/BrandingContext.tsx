import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AgencyBranding {
  logo_url?: string;
  primary_color?: string;
  agency_name?: string;
  enabled?: boolean;
}

interface BrandingContextType {
  branding: AgencyBranding | null;
  canWhiteLabel: boolean;
  isCustomBrandingActive: boolean;
  loading: boolean;
  refetch: () => void;
}

const BrandingContext = createContext<BrandingContextType>({
  branding: null,
  canWhiteLabel: false,
  isCustomBrandingActive: false,
  loading: true,
  refetch: () => {},
});

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [branding, setBranding] = useState<AgencyBranding | null>(null);
  const [canWhiteLabel, setCanWhiteLabel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchKey, setFetchKey] = useState(0);

  const refetch = () => setFetchKey(k => k + 1);

  useEffect(() => {
    const fetchBranding = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data: userRole } = await supabase
          .from('user_roles')
          .select('agency_id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!userRole?.agency_id) {
          setLoading(false);
          return;
        }

        const { data: agency } = await supabase
          .from('agencies')
          .select('plan_tier, branding, name')
          .eq('id', userRole.agency_id)
          .single();

        if (agency) {
          const tier = agency.plan_tier as string;
          const whiteLabel = tier === 'growth' || tier === 'scale';
          setCanWhiteLabel(whiteLabel);

          if (whiteLabel && agency.branding) {
            const b = agency.branding as AgencyBranding;
            setBranding({
              ...b,
              agency_name: b.agency_name || agency.name || '',
            });
          } else {
            setBranding(null);
          }
        }
      } catch (error) {
        console.error('Error fetching branding:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBranding();
  }, [user, fetchKey]);

  const isCustomBrandingActive = canWhiteLabel && branding?.enabled === true && Boolean(branding?.agency_name || branding?.logo_url);

  return (
    <BrandingContext.Provider value={{ branding, canWhiteLabel, isCustomBrandingActive, loading, refetch }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
