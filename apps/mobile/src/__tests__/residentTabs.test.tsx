// The resident area: six tabs, and detail routes (used by notification taps)
// that open inside their tab with the list underneath.
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
const ResidentLayout = require('../app/(resident)/_layout').default;
const NoticesLayout = require('../app/(resident)/notices/_layout');
const ComplaintsLayout = require('../app/(resident)/complaints/_layout');
const BillsLayout = require('../app/(resident)/bills/_layout');
/* eslint-enable @typescript-eslint/no-require-imports */

/** A stub screen; detail stubs (`withId`) also print the id param. */
const Stub = (label: string, withId = false) =>
  function StubScreen() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    return <Text>{withId && id ? `${label} ${id}` : label}</Text>;
  };

const routes = {
  '(resident)/_layout': ResidentLayout,
  '(resident)/index': Stub('HOME'),
  '(resident)/notices/_layout': NoticesLayout,
  '(resident)/notices/index': Stub('NOTICES'),
  '(resident)/notices/[id]': Stub('NOTICE', true),
  '(resident)/complaints/_layout': ComplaintsLayout,
  '(resident)/complaints/index': Stub('COMPLAINTS'),
  '(resident)/complaints/new': Stub('NEW COMPLAINT'),
  '(resident)/complaints/[id]': Stub('COMPLAINT', true),
  '(resident)/bills/_layout': BillsLayout,
  '(resident)/bills/index': Stub('BILLS'),
  '(resident)/bills/[id]': Stub('BILL', true),
  '(resident)/family': Stub('FAMILY'),
  '(resident)/more': Stub('MORE'),
  '(resident)/passes': Stub('PASSES'),
  '(resident)/history': Stub('HISTORY'),
  '(resident)/change-password': Stub('CHANGE PASSWORD'),
  '(resident)/request/[id]': Stub('REQUEST', true),
};

it('shows the six resident tabs and opens Home first', async () => {
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('HOME')).toBeTruthy();
  for (const label of ['Home', 'Notices', 'Complaints', 'Bills', 'Family', 'More']) {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0);
  }
  expect(screen.queryByText('Passes')).toBeNull();
});

it('switches tabs', async () => {
  await renderRouter(routes, { initialUrl: '/' });
  await screen.findByText('HOME');
  await act(async () => fireEvent.press(screen.getByLabelText(/^Bills/)));
  expect(await screen.findByText('BILLS')).toBeTruthy();
});

it.each([
  ['/notices/n1', 'NOTICE n1'],
  ['/complaints/c1', 'COMPLAINT c1'],
  ['/bills/b1', 'BILL b1'],
  ['/request/v1', 'REQUEST v1'],
])('opens the detail route %s', async (url, text) => {
  await renderRouter(routes, { initialUrl: url });
  expect(await screen.findByText(text)).toBeTruthy();
});

it('keeps the list under a detail opened directly (e.g. from a notification)', async () => {
  await renderRouter(routes, { initialUrl: '/complaints/c1' });
  await screen.findByText('COMPLAINT c1');
  await act(async () => router.back());
  expect(await screen.findByText('COMPLAINTS')).toBeTruthy();
});
