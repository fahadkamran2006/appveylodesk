/**
 * Maps low-level errors (Supabase/PostgREST/Postgres/network) to friendly,
 * user-facing messages with optional next-step guidance.
 *
 * Usage:
 *   const { title, description } = toFriendlyError(err, { context: 'upload' });
 *   toast({ title, description, variant: 'destructive' });
 *
 * Or use the helper:
 *   showFriendlyError(toast, err, { context: 'upload' });
 */

export type FriendlyErrorContext =
  | 'upload'
  | 'download'
  | 'save'
  | 'load'
  | 'delete'
  | 'auth'
  | 'payment'
  | 'generic';

export interface FriendlyError {
  title: string;
  description: string;
  /** Stable identifier so the UI can branch (e.g. show an upgrade CTA). */
  code:
    | 'missing_table'
    | 'permission_denied'
    | 'not_found'
    | 'unique_violation'
    | 'storage_full'
    | 'free_plan_limit'
    | 'network'
    | 'timeout'
    | 'file_too_large'
    | 'invalid_input'
    | 'rate_limited'
    | 'server'
    | 'unknown';
}

interface NormalizedError {
  message: string;
  code?: string;
  status?: number;
  details?: string;
  hint?: string;
}

function normalize(err: unknown): NormalizedError {
  if (!err) return { message: '' };
  if (typeof err === 'string') return { message: err };
  const e = err as Record<string, unknown> & { message?: unknown };
  const status =
    typeof e.status === 'number'
      ? (e.status as number)
      : typeof e.statusCode === 'number'
        ? (e.statusCode as number)
        : undefined;
  return {
    message: typeof e.message === 'string' ? e.message : String(e.message ?? ''),
    code: typeof e.code === 'string' ? (e.code as string) : undefined,
    status,
    details: typeof e.details === 'string' ? (e.details as string) : undefined,
    hint: typeof e.hint === 'string' ? (e.hint as string) : undefined,
  };
}

const nextStepsByContext: Record<FriendlyErrorContext, string> = {
  upload:
    'Check your internet connection, then resume the upload from the queue. If it keeps failing, try a smaller file or contact support.',
  download:
    'Refresh the page and try the download again. If the file is large, switch to a stable connection.',
  save: 'Refresh and try again. If the problem persists, copy your work and reload.',
  load: 'Refresh the page. If it still fails, check your connection or try again in a minute.',
  delete: 'Refresh the page and try again. Make sure the item still exists.',
  auth: 'Sign out and sign back in to refresh your session.',
  payment: 'Try a different card or refresh the page. Contact support if it keeps failing.',
  generic: 'Please refresh the page and try again.',
};

export function toFriendlyError(
  err: unknown,
  opts: { context?: FriendlyErrorContext } = {}
): FriendlyError {
  const context = opts.context ?? 'generic';
  const n = normalize(err);
  const msg = (n.message || '').toLowerCase();
  const code = n.code || '';

  // ---- Free plan / app-level limits ----------------------------------------
  if (msg.includes('free_plan_project_limit')) {
    return {
      title: 'Free plan limit reached',
      description:
        'You can only have one active project on the Free plan. Mark a project as done or upgrade to add more.',
      code: 'free_plan_limit',
    };
  }
  if (msg.includes('free_plan_client_limit') || msg.includes('client_limit')) {
    return {
      title: 'Client limit reached',
      description:
        'You have hit your plan\u2019s client limit. Upgrade your plan to invite more clients.',
      code: 'free_plan_limit',
    };
  }
  if (msg.includes('storage') && (msg.includes('limit') || msg.includes('quota') || msg.includes('full'))) {
    return {
      title: 'Storage limit reached',
      description:
        'You\u2019ve used all of your plan\u2019s storage. Free up space or upgrade to continue uploading.',
      code: 'storage_full',
    };
  }

  // ---- PostgREST / Postgres specific codes ---------------------------------
  // Missing table: PGRST205 / "Could not find the table"
  if (
    code === 'PGRST205' ||
    msg.includes("could not find the table") ||
    msg.includes('relation') && msg.includes('does not exist')
  ) {
    return {
      title: 'This feature isn\u2019t ready yet',
      description:
        'A required part of the database hasn\u2019t finished setting up. Refresh in a moment \u2014 if it keeps failing, contact support so we can finish provisioning it for your account.',
      code: 'missing_table',
    };
  }

  // RLS / permission denied
  if (
    code === '42501' ||
    code === 'PGRST301' ||
    msg.includes('permission denied') ||
    msg.includes('row-level security') ||
    msg.includes('not authorized')
  ) {
    return {
      title: 'You don\u2019t have access to this',
      description:
        'Your account doesn\u2019t have permission for this action. If you think this is wrong, ask an admin to grant access.',
      code: 'permission_denied',
    };
  }

  // Unique violation
  if (code === '23505' || msg.includes('duplicate key') || msg.includes('already exists')) {
    return {
      title: 'Already exists',
      description: 'An item with these details already exists. Try a different name or value.',
      code: 'unique_violation',
    };
  }

  // Foreign key / check violation
  if (code === '23503' || code === '23514') {
    return {
      title: 'Couldn\u2019t save this',
      description:
        n.hint || 'Some of the values are invalid or reference items that no longer exist. Refresh and try again.',
      code: 'invalid_input',
    };
  }

  // Not found
  if (
    code === 'PGRST116' ||
    n.status === 404 ||
    msg.includes('not found') ||
    msg.includes('no rows')
  ) {
    return {
      title: 'Not found',
      description: 'We couldn\u2019t find what you were looking for. It may have been removed.',
      code: 'not_found',
    };
  }

  // ---- HTTP status based ----------------------------------------------------
  if (n.status === 401 || n.status === 403) {
    return {
      title: 'Session expired',
      description: 'Please sign in again to continue.',
      code: 'permission_denied',
    };
  }
  if (n.status === 408 || msg.includes('timeout') || msg.includes('timed out')) {
    return {
      title: 'Request timed out',
      description: nextStepsByContext[context],
      code: 'timeout',
    };
  }
  if (n.status === 413 || msg.includes('payload too large') || msg.includes('file too large')) {
    return {
      title: 'File is too large',
      description:
        'Try compressing the file or splitting it into smaller parts. Large videos upload best in MP4 format.',
      code: 'file_too_large',
    };
  }
  if (n.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return {
      title: 'Too many requests',
      description: 'Please wait a few seconds and try again.',
      code: 'rate_limited',
    };
  }
  if (n.status && n.status >= 500) {
    return {
      title: 'Server error',
      description: nextStepsByContext[context],
      code: 'server',
    };
  }

  // Network / fetch failures
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('load failed')
  ) {
    return {
      title: 'Connection problem',
      description: 'You appear to be offline. Check your internet connection and try again.',
      code: 'network',
    };
  }

  // ---- Fallback -------------------------------------------------------------
  return {
    title: context === 'upload' ? 'Upload failed' : 'Something went wrong',
    description: n.message ? `${n.message}. ${nextStepsByContext[context]}` : nextStepsByContext[context],
    code: 'unknown',
  };
}

/** Toast-friendly helper. Works with the legacy `useToast` hook signature. */
export function showFriendlyError(
  toast: (args: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void,
  err: unknown,
  opts: { context?: FriendlyErrorContext } = {}
): FriendlyError {
  const f = toFriendlyError(err, opts);
  toast({ title: f.title, description: f.description, variant: 'destructive' });
  // eslint-disable-next-line no-console
  console.error(`[${f.code}]`, err);
  return f;
}
