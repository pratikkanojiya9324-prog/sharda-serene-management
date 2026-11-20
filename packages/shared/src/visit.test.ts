import { describe, it, expect } from 'vitest';
import { shouldShowCallButton } from './visit';

const t0 = '2026-11-20T10:00:00Z';

describe('shouldShowCallButton', () => {
  it('hidden before 60s', () => expect(shouldShowCallButton({status:'pending',created_at:t0,no_app_users:false}, new Date('2026-11-20T10:00:59Z'))).toBe(false));
  it('shown at 60s',     () => expect(shouldShowCallButton({status:'pending',created_at:t0,no_app_users:false}, new Date('2026-11-20T10:01:00Z'))).toBe(true));
  it('shown immediately when no app users', () => expect(shouldShowCallButton({status:'pending',created_at:t0,no_app_users:true}, new Date(t0))).toBe(true));
  it('hidden once answered', () => expect(shouldShowCallButton({status:'approved',created_at:t0,no_app_users:true}, new Date('2026-11-20T10:05:00Z'))).toBe(false));
  it('shown when expired', () => expect(shouldShowCallButton({status:'expired',created_at:t0,no_app_users:false}, new Date('2026-11-20T10:11:00Z'))).toBe(true));
});
