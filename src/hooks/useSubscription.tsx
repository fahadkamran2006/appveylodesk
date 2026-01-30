import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface SubscriptionStatus {
  isActive: boolean;
  planTier: string | null;
  subscriptionEndsAt: string | null;
  loading: boolean;
  agencyId: string | null;
}

export const useSubscription = (): SubscriptionStatus => {
  const { user, userRole, loading: authLoading } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    isActive: false,
    planTier: null,
    subscriptionEndsAt: null,
    loading: true,
    agencyId: null,
  });

  useEffect(() => {
    const checkSubscription = async () => {
      if (authLoading) return;
      
      if (!user) {
        setSubscriptionStatus({
          isActive: false,
          planTier: null,
          subscriptionEndsAt: null,
          loading: false,
          agencyId: null,
        });
        return;
      }

      try {
        // Get user's agency
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile?.agency_id) {
          setSubscriptionStatus({
            isActive: false,
            planTier: null,
            subscriptionEndsAt: null,
            loading: false,
            agencyId: null,
          });
          return;
        }

        // Get agency subscription details
        const { data: agency } = await supabase
          .from('agencies')
          .select('plan_tier, subscription_ends_at')
          .eq('id', profile.agency_id)
          .maybeSingle();

        if (!agency) {
          setSubscriptionStatus({
            isActive: false,
            planTier: null,
            subscriptionEndsAt: null,
            loading: false,
            agencyId: profile.agency_id,
          });
          return;
        }

        // Check if subscription is active
        // Active if subscription_ends_at is null (never set) OR in the future
        const now = new Date();
        const endsAt = agency.subscription_ends_at ? new Date(agency.subscription_ends_at) : null;
        
        // For active subscription: ends_at must be set AND be in the future
        const isActive = endsAt !== null && endsAt > now;

        setSubscriptionStatus({
          isActive,
          planTier: agency.plan_tier,
          subscriptionEndsAt: agency.subscription_ends_at,
          loading: false,
          agencyId: profile.agency_id,
        });
      } catch (error) {
        console.error('Error checking subscription:', error);
        setSubscriptionStatus({
          isActive: false,
          planTier: null,
          subscriptionEndsAt: null,
          loading: false,
          agencyId: null,
        });
      }
    };

    checkSubscription();
  }, [user, authLoading]);

  return subscriptionStatus;
};

// Checkout URL generator
export const CHECKOUT_LINKS = {
  starter: {
    monthly: 'https://veylodesk.lemonsqueezy.com/checkout/buy/7c7d7e08-aa11-4eb6-b1d3-d560f495c744?enabled=1262852',
    yearly: 'https://veylodesk.lemonsqueezy.com/checkout/buy/b364418d-cf0d-48c7-b30b-37610ccd36b3?enabled=1262845',
  },
  growth: {
    monthly: 'https://veylodesk.lemonsqueezy.com/checkout/buy/ef1dbf59-856e-4577-959d-052786bd1e72?enabled=1263073',
    yearly: 'https://veylodesk.lemonsqueezy.com/checkout/buy/3980ebc4-f83a-4148-a2b6-7635813f5b3e?enabled=1263072',
  },
  scale: {
    monthly: 'https://veylodesk.lemonsqueezy.com/checkout/buy/abb70d87-9ff6-4f27-855a-3ff8da494882?enabled=1263145',
    yearly: 'https://veylodesk.lemonsqueezy.com/checkout/buy/62f2b280-a789-48f2-a418-3a6a9713e2c3?enabled=1263144',
  },
};

export const getCheckoutUrl = (
  plan: 'starter' | 'growth' | 'scale',
  interval: 'monthly' | 'yearly',
  agencyId: string
): string => {
  const baseUrl = CHECKOUT_LINKS[plan][interval];
  return `${baseUrl}&checkout[custom][agency_id]=${agencyId}`;
};
