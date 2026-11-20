import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { shouldShowCallButton } from '@society-gate/shared';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';

import { CallResident } from './CallResident';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

// Mirrors the visit screen: `visible` comes from shouldShowCallButton, re-evaluated every second.
function Harness({ createdAt, noAppUsers }: { createdAt: number; noAppUsers: boolean }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const visible = shouldShowCallButton(
    { status: 'pending', created_at: new Date(createdAt).toISOString(), no_app_users: noAppUsers },
    now,
  );
  return <CallResident flatId="flat-1" visible={visible} noAppUsers={noAppUsers} />;
}

describe('CallResident', () => {
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    mockRpc.mockResolvedValue({ data: [{ name: 'Asha', phone: '+919876543210' }], error: null });
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue();
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    mockRpc.mockReset();
  });

  it('hides the call button for a fresh pending visit, shows it after 60 s, and dials the contact', async () => {
    await render(<Harness createdAt={Date.now()} noAppUsers={false} />);
    expect(screen.queryByText(/Call Asha/)).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    await fireEvent.press(await screen.findByText(/Call Asha/));
    expect(openURL).toHaveBeenCalledWith('tel:+919876543210');
    expect(mockRpc).toHaveBeenCalledWith('flat_contacts', { p_flat_id: 'flat-1' });
  });

  it('shows immediately with the no-app-users header when nobody uses the app', async () => {
    await render(<Harness createdAt={Date.now()} noAppUsers />);
    expect(await screen.findByText('No one in this flat uses the app — call them')).toBeTruthy();
    expect(await screen.findByText(/Call Asha/)).toBeTruthy();
  });
});
