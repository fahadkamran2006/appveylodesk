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
        setSubscriptionStatus({ isActive: false, planTier: null, subscriptionEndsAt: null, loading: false, agencyId: null });
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('agency_id')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile?.agency_id) {
          setSubscriptionStatus({ isActive: false, planTier: null, subscriptionEndsAt: null, loading: false, agencyId: null });
          return;
        }

        const { data: agency } = await supabase
          .from('agencies')
          .select('plan_tier, subscription_ends_at')
          .eq('id', profile.agency_id)
          .maybeSingle();

        if (!agency) {
          setSubscriptionStatus({ isActive: false, planTier: null, subscriptionEndsAt: null, loading: false, agencyId: profile.agency_id });
          return;
        }

        const now = new Date();
        const endsAt = agency.subscription_ends_at ? new Date(agency.subscription_ends_at) : null;
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
        setSubscriptionStatus({ isActive: false, planTier: null, subscriptionEndsAt: null, loading: false, agencyId: null });
      }
    };

    checkSubscription();
  }, [user, authLoading]);

  return subscriptionStatus;
};

// Paddle Price IDs
const PADDLE_PRICES = {
  starter: {
    monthly: 'pri_01khrz050sv0w1a4ewyvv5arb1',
    yearly: 'pri_01khs05dqng1qr8xck4afwdf6y',
  },
  growth: {
    monthly: 'pri_01khs06hcgeff068rncwjnqxns',
    yearly: 'pri_01khs0896ryegzxcpra0sxbnn6',
  },
  scale: {
    monthly: 'pri_01khs09b0z4rm4mkz1wk3b38ms',
    yearly: 'pri_01khs0as29km3edtr84n7fxfbs',
  },
};

export const getPaddlePriceId = (
  plan: 'starter' | 'growth' | 'scale',
  interval: 'monthly' | 'yearly'
): string => {
  return PADDLE_PRICES[plan][interval];
};

// Open Paddle checkout overlay
export const openPaddleCheckout = (
  plan: 'starter' | 'growth' | 'scale',
  interval: 'monthly' | 'yearly',
  agencyId: string,
  userEmail?: string
) => {
  const priceId = getPaddlePriceId(plan, interval);
  
  const checkoutSettings: any = {
    items: [{ priceId, quantity: 1 }],
    customData: { agency_id: agencyId },
    settings: {
      displayMode: 'overlay',
      theme: 'dark',
      successUrl: `${window.location.origin}/admin/dashboard`,
    },
  };

  if (userEmail) {
    checkoutSettings.customer = { email: userEmail };
  }

  // @ts-ignore - Paddle is loaded globally
  if (window.Paddle) {
    // @ts-ignore
    window.Paddle.Checkout.open(checkoutSettings);
  } else {
    console.error('Paddle.js not loaded');
  }
};
