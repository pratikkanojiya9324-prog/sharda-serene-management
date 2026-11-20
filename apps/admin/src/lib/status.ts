import type { IconName } from '../components/Icon';
import type { Tone } from '../components/ui';

export const COMPLAINT_CATEGORIES = ['plumbing', 'electrical', 'lift', 'cleaning', 'security', 'parking', 'other'] as const;
export const COMPLAINT_STATUSES = ['open', 'in_progress', 'resolved'] as const;
export const PAYMENT_MODES = ['cash', 'cheque', 'upi', 'other'] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];
export type PaymentMode = (typeof PAYMENT_MODES)[number];

export const COMPLAINT_STATUS_STYLE: Record<ComplaintStatus, { label: string; tone: Tone; icon: IconName }> = {
  open: { label: 'Open', tone: 'amber', icon: 'alert' },
  in_progress: { label: 'In progress', tone: 'blue', icon: 'clock' },
  resolved: { label: 'Resolved', tone: 'green', icon: 'check' },
};

export const BILL_STATUS_STYLE: Record<'paid' | 'unpaid', { label: string; tone: Tone; icon: IconName }> = {
  paid: { label: 'Paid', tone: 'green', icon: 'check' },
  unpaid: { label: 'Unpaid', tone: 'amber', icon: 'clock' },
};

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = { cash: 'Cash', cheque: 'Cheque', upi: 'UPI', other: 'Other' };

export function visitStyle(status: string): { tone: Tone; icon: IconName } {
  if (status === 'approved') return { tone: 'green', icon: 'check' };
  if (status === 'denied') return { tone: 'red', icon: 'ban' };
  if (status === 'pending') return { tone: 'amber', icon: 'clock' };
  return { tone: 'slate', icon: 'info' };
}
