// The admin area: four tabs (Notices first), the new-notice screen without a
// tab button, and the complaint detail (opened from a complaint_created push)
// inside the Complaints tab with the list underneath.
import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn(async () => ({ data: { session: null } })) },
  },
}));

/* eslint-disable @typescript-eslint/no-require-imports */
const AdminLayout = require('../app/(admin)/_layout').default;
const ComplaintsLayout = require('../app/(admin)/complaints/_layout');
/* eslint-enable @typescript-eslint/no-require-imports */

const Stub = (label: string, withId = false) =>
  function StubScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    return <Text>{withId && id ? `${label} ${id}` : label}</Text>;
  };

const routes = {
  '(admin)/_layout': AdminLayout,
  '(admin)/index': Stub('NOTICES'),
  '(admin)/notices/new': Stub('NEW NOTICE'),
  '(admin)/complaints/_layout': ComplaintsLayout,
  '(admin)/complaints/index': Stub('COMPLAINTS'),
  '(admin)/complaints/[id]': Stub('COMPLAINT', true),
  '(admin)/bills/index': Stub('BILLS'),
  '(admin)/more': Stub('MORE'),
};

it('shows the four admin tabs and opens Notices first', async () => {
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('NOTICES')).toBeTruthy();
  for (const label of ['Notices', 'Complaints', 'Bills', 'More']) {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  }
  expect(screen.queryByText('New notice')).toBeNull();
});

it('switches tabs and opens the new-notice screen', async () => {
  await renderRouter(routes, { initialUrl: '/' });
  await screen.findByText('NOTICES');
  await act(async () => fireEvent.press(screen.getByLabelText(/^Bills/)));
  expect(await screen.findByText('BILLS')).toBeTruthy();
  await act(async () => router.push('/(admin)/notices/new'));
  expect(await screen.findByText('NEW NOTICE')).toBeTruthy();
});

it('keeps the complaints list under a complaint opened directly (e.g. from a notification)', async () => {
  await renderRouter(routes, { initialUrl: '/complaints/c1' });
  expect(await screen.findByText('COMPLAINT c1')).toBeTruthy();
  await act(async () => router.back());
  expect(await screen.findByText('COMPLAINTS')).toBeTruthy();
});
