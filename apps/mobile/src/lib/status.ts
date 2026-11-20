import type { Database } from '@society-gate/shared';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { Tone } from '@/theme/tokens';

import { localDateString } from './format';

type Enums = Database['public']['Enums'];
type IconName = ComponentProps<typeof Ionicons>['name'];

/** What a status pill shows: text, colour tone and icon. */
export type StatusInfo = { label: string; tone: Tone; icon: IconName };

/** Paid / Unpaid / Overdue (unpaid after the due date; the due day itself is not overdue). */
export function billStatusPill(status: Enums['bill_status'], dueDate: string, today: Date = new Date()): StatusInfo {
  if (status === 'paid') return { label: 'Paid', tone: 'success', icon: 'checkmark-circle' };
  if (localDateString(today) > dueDate) return { label: 'Overdue', tone: 'danger', icon: 'alert-circle' };
  return { label: 'Unpaid', tone: 'warning', icon: 'time' };
}

const COMPLAINT_STATUS: Record<Enums['complaint_status'], StatusInfo> = {
  open: { label: 'Open', tone: 'warning', icon: 'alert-circle' },
  in_progress: { label: 'In progress', tone: 'info', icon: 'construct' },
  resolved: { label: 'Resolved', tone: 'success', icon: 'checkmark-circle' },
};

export function complaintStatus(status: Enums['complaint_status']): StatusInfo {
  return COMPLAINT_STATUS[status];
}

export type CategoryInfo = { value: Enums['complaint_category']; label: string; icon: IconName };

export const COMPLAINT_CATEGORIES: readonly CategoryInfo[] = [
  { value: 'plumbing', label: 'Plumbing', icon: 'water' },
  { value: 'electrical', label: 'Electrical', icon: 'flash' },
  { value: 'lift', label: 'Lift', icon: 'swap-vertical' },
  { value: 'cleaning', label: 'Cleaning', icon: 'sparkles' },
  { value: 'security', label: 'Security', icon: 'shield-checkmark' },
  { value: 'parking', label: 'Parking', icon: 'car' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle' },
];

export function complaintCategory(value: Enums['complaint_category']): CategoryInfo {
  return COMPLAINT_CATEGORIES.find((c) => c.value === value) ?? COMPLAINT_CATEGORIES[COMPLAINT_CATEGORIES.length - 1];
}

const VISIT_STATUS: Record<Enums['visit_status'], StatusInfo> = {
  pending: { label: 'Waiting', tone: 'accent', icon: 'hourglass' },
  approved: { label: 'Approved', tone: 'success', icon: 'checkmark-circle' },
  denied: { label: 'Denied', tone: 'danger', icon: 'close-circle' },
  leave_at_gate: { label: 'Leave at gate', tone: 'info', icon: 'cube' },
  expired: { label: 'Expired', tone: 'neutral', icon: 'time' },
};

export function visitStatus(status: Enums['visit_status']): StatusInfo {
  return VISIT_STATUS[status];
}

/** Pill for a visit row: the guard's own decision wins over the request status. */
export function visitPill(visit: {
  status: Enums['visit_status'];
  manual_outcome: Enums['manual_outcome'] | null;
}): StatusInfo {
  if (visit.manual_outcome === 'allowed') return { label: 'Let in by guard', tone: 'success', icon: 'shield-checkmark' };
  if (visit.manual_outcome === 'sent_back') return { label: 'Sent back', tone: 'danger', icon: 'arrow-undo' };
  return VISIT_STATUS[visit.status];
}

export const VISIT_PURPOSE: Record<Enums['visit_purpose'], { label: string; icon: IconName }> = {
  delivery: { label: 'Delivery', icon: 'cube' },
  guest: { label: 'Guest', icon: 'person' },
  cab: { label: 'Cab', icon: 'car' },
  service: { label: 'Service', icon: 'construct' },
  other: { label: 'Visitor', icon: 'walk' },
};

export const PAYMENT_MODE_LABEL: Record<Enums['payment_mode'], string> = {
  cash: 'Cash',
  cheque: 'Cheque',
  upi: 'UPI',
  other: 'Other',
};
