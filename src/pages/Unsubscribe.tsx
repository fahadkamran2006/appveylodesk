import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setStatus('error'); return; }
    (async () => {
      const { data, error } = await supabase.functions.invoke('welcome-sequence-unsubscribe', { body: { token } });
      setStatus(!error && (data as any)?.ok ? 'ok' : 'error');
    })();
  }, [params]);

  return (
    <div style={{ minHeight: '100vh', background: '#0D0D1F', color: '#BBBBDD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', padding: '24px' }}>
      <div style={{ background: '#16162E', padding: '40px', borderRadius: '12px', maxWidth: '480px', textAlign: 'center' }}>
        <div style={{ color: '#4B4BE1', fontWeight: 800, letterSpacing: 2, marginBottom: 20 }}>VEYLODESK</div>
        {status === 'loading' && <p>Updating your preferences…</p>}
        {status === 'ok' && (
          <>
            <h1 style={{ color: '#fff', fontSize: 22, margin: '0 0 12px' }}>You're unsubscribed</h1>
            <p>You won't receive any more onboarding emails from us. Reply to any past email if you change your mind.</p>
          </>
        )}
        {status === 'error' && (
          <>
            <h1 style={{ color: '#fff', fontSize: 22, margin: '0 0 12px' }}>Link invalid</h1>
            <p>This unsubscribe link is invalid or expired. Email hello@fahadkamran.com and we'll handle it manually.</p>
          </>
        )}
      </div>
    </div>
  );
}
