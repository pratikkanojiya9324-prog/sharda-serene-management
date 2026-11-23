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
