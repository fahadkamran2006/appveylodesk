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
    monthly: 'https://veylodesk.lemonsqueezy.com/checkout/buy/bb7da811-c5c6-43aa-aec0-2cc3e8268a3e?enabled=1294953',
    yearly: 'https://veylodesk.lemonsqueezy.com/checkout/buy/570a4f07-132e-4aac-9717-34e47aba61fa?enabled=1294952',
  },
  growth: {
    monthly: 'https://veylodesk.lemonsqueezy.com/checkout/buy/56b69aaf-41d8-44ff-beae-af5617e18673?enabled=1294944',
    yearly: 'https://veylodesk.lemonsqueezy.com/checkout/buy/cc48914b-bd61-476f-9092-ff7a7f2096f2?enabled=1294943',
  },
  scale: {
    monthly: 'https://veylodesk.lemonsqueezy.com/checkout/buy/e3acb0e8-3321-402c-830b-99f7b431e847?enabled=1294947',
    yearly: 'https://veylodesk.lemonsqueezy.com/checkout/buy/23af3ace-41d0-437c-9abf-f5449cf4a479?enabled=1294946',
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
