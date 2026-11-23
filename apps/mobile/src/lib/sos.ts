import type { SosType } from '@society-gate/shared';

/** How long the SOS button must be held before it fires. */
export const SOS_HOLD_MS = 2000;

export type SosStatus = 'open' | 'acknowledged' | 'resolved' | 'cancelled';

/** An alert row as read with SOS_SELECT. */
export type SosAlert = {
  id: string;
  flat_id: string;
  type: SosType;
  status: SosStatus;
  raised_by_name: string | null;
  created_at: string;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolved_note: string | null;
  resolved_by_name: string | null;
  flats?: { number: string; towers: { building: string; name: string } | null } | null;
};

const LABEL: Record<SosType, string> = {
  medical: 'Medical',
  fire: 'Fire',
  security: 'Security',
  lift: 'Lift stuck',
  other: 'Other',
};

const ICON = {
  medical: 'medkit',
  fire: 'flame',
  security: 'shield',
  lift: 'swap-vertical',
  other: 'alert-circle',
} as const;

export const sosTypeLabel = (t: SosType): string => LABEL[t];
export const sosTypeIcon = (t: SosType): (typeof ICON)[SosType] => ICON[t];

export function sosStatusText(a: { status: SosStatus; acknowledged_by_name: string | null }): string {
  switch (a.status) {
    case 'open':
      return 'Sent — alerting the guards';
    case 'acknowledged': {
      const name = a.acknowledged_by_name?.trim();
      return `${name || 'A guard'} is on the way`;
    }
    case 'resolved':
      return 'Resolved';
    case 'cancelled':
      return 'Cancelled';
  }
}

export type SosSendState = 'idle' | 'sending' | 'failed' | 'active' | 'done';

/** Which view the resident's SOS screen shows. A failure is never hidden behind a spinner. */
export function sosSendState(r: {
  busy: boolean;
  error: string | null;
  alert: { status: SosStatus } | null;
}): SosSendState {
  if (r.busy) return 'sending';
  if (r.error && !r.alert) return 'failed';
  if (r.alert?.status === 'open' || r.alert?.status === 'acknowledged') return 'active';
  if (r.alert) return 'done';
  return 'idle';
}

export const isActiveSos = (a: { status: SosStatus } | null | undefined): boolean =>
  a?.status === 'open' || a?.status === 'acknowledged';

const SOS_TYPE_VALUES: readonly string[] = ['medical', 'fire', 'security', 'lift', 'other'];

/**
 * Decides whether the SOS screen should send for its route params. Each press on
 * Home carries a fresh `at` nonce, so the same type can be sent again later (the
 * hidden tab stays mounted), while a re-render with the same params never re-sends.
 */
export function sosSendRequest(
  params: { type?: string; at?: string },
  lastKey: string | null,
): { type: SosType; key: string } | null {
  if (!params.type || !SOS_TYPE_VALUES.includes(params.type)) return null;
  const key = `${params.type}:${params.at ?? ''}`;
  if (key === lastKey) return null;
  return { type: params.type as SosType, key };
}

export const SOS_TIMEOUT_MS = 15000;
export const SOS_TIMEOUT_TEXT = 'No response — check your internet';

/** Rejects with an Error whose message is SOS_TIMEOUT_TEXT if `p` takes longer than `ms`. */
export function withTimeout<T>(p: PromiseLike<T>, ms = SOS_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(SOS_TIMEOUT_TEXT)), ms);
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
