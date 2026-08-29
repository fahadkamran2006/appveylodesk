import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AgencyClient {
  id: string;
  name: string;
  email: string;
  isManaged?: boolean;
}

/**
 * Resolves the current user's agency id with multiple fallbacks:
 * 1. user_roles.agency_id
 * 2. profiles.agency_id
 * 3. agencies.created_by = user.id
 */
export async function resolveAgencyId(userId: string): Promise<string | null> {
  const { data: role } = await supabase
    .from('user_roles')
    .select('agency_id')
    .eq('user_id', userId)
    .not('agency_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (role?.agency_id) return role.agency_id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('agency_id')
    .eq('id', userId)
    .maybeSingle();
  if (profile?.agency_id) return profile.agency_id;

  const { data: agency } = await supabase
    .from('agencies')
    .select('id')
    .eq('created_by', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return agency?.id ?? null;
}

/**
 * Fetches all selectable clients for the current agency:
 * registered clients (user_roles + profiles) and manual clients (managed_clients),
 * de-duplicated by id and email.
 */
export function useAgencyClients(enabled: boolean) {
  const { user } = useAuth();
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [agencyId, setAgencyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchClients = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const resolvedAgencyId = await resolveAgencyId(user.id);
      setAgencyId(resolvedAgencyId);

      const collected: AgencyClient[] = [];

      if (resolvedAgencyId) {
        const [{ data: clientRoles, error: rolesError }, { data: acceptedInvites, error: invitesError }] =
          await Promise.all([
            supabase
              .from('user_roles')
              .select('user_id')
              .eq('agency_id', resolvedAgencyId)
              .eq('role', 'client'),
            supabase
              .from('agency_invitations')
              .select('accepted_by, full_name, email')
              .eq('agency_id', resolvedAgencyId)
              .eq('role', 'client')
              .not('accepted_at', 'is', null)
              .not('accepted_by', 'is', null),
          ]);

        if (rolesError) console.error('Error fetching client roles:', rolesError);
        if (invitesError) console.error('Error fetching accepted client invitations:', invitesError);

        const clientIds = (clientRoles || []).map((r) => r.user_id);
        if (clientIds.length > 0) {
          const { data: clientProfiles, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', clientIds);
          if (profilesError) console.error('Error fetching client profiles:', profilesError);
          for (const p of clientProfiles || []) {
            collected.push({ id: p.id, name: p.full_name || p.email, email: p.email });
          }
        }

        // Accepted invitations are an authoritative fallback when the admin's
        // user_roles/profile SELECT policy has not yet been migrated correctly.
        for (const invitation of acceptedInvites || []) {
          if (!invitation.accepted_by) continue;
          collected.push({
            id: invitation.accepted_by,
            name: invitation.full_name || invitation.email,
            email: invitation.email,
          });
        }
      }

      // Manual clients: by agency, with fallback to rows this user created
      const managedQuery = supabase
        .from('managed_clients')
        .select('id, full_name, email, activated_at')
        .is('activated_at', null);

      const { data: managed, error: managedError } = resolvedAgencyId
        ? await managedQuery.eq('agency_id', resolvedAgencyId)
        : await managedQuery.eq('created_by', user.id);

      if (managedError) console.error('Error fetching manual clients:', managedError);

      let managedRows = managed || [];
      if (resolvedAgencyId && managedRows.length === 0) {
        const { data: byCreator } = await supabase
          .from('managed_clients')
          .select('id, full_name, email, activated_at')
          .is('activated_at', null)
          .eq('created_by', user.id);
        managedRows = byCreator || [];
      }

      for (const m of managedRows) {
        collected.push({
          id: `mc:${m.id}`,
          name: (m.full_name || m.email) + ' (Manual)',
          email: m.email,
          isManaged: true,
        });
      }

      // De-duplicate by id and email
      const seenIds = new Set<string>();
      const seenEmails = new Set<string>();
      const unique = collected.filter((c) => {
        const email = (c.email || '').toLowerCase();
        if (seenIds.has(c.id)) return false;
        if (email && seenEmails.has(email)) return false;
        seenIds.add(c.id);
        if (email) seenEmails.add(email);
        return true;
      });

      setClients(unique);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (enabled) fetchClients();
  }, [enabled, fetchClients]);

  // Realtime: refresh when clients or roles change
  useEffect(() => {
    if (!enabled || !user) return;
    const channel = supabase
      .channel(`agency-clients-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'managed_clients' }, () => {
        fetchClients();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, () => {
        fetchClients();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, user, fetchClients]);

  return { clients, agencyId, loading, refetch: fetchClients };
}
