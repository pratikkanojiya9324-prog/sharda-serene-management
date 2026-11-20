// Regression: a signed-out user opening the app landed on "Unmatched Route",
// because "/" only existed inside the signed-in-only group.
import { screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  useLastNotificationResponse: () => null,
  DEFAULT_ACTION_IDENTIFIER: 'default',
}));
jest.mock('@/lib/postLogin', () => ({ bootstrapSignedInUser: jest.fn() }));
jest.mock('@/lib/push', () => ({ registerPushToken: jest.fn() }));
jest.mock('@/lib/signOut', () => ({ signOut: jest.fn() }));

/* eslint-disable @typescript-eslint/no-require-imports */
const RootLayout = require('../app/_layout').default;
const Index = require('../app/index').default;
/* eslint-enable @typescript-eslint/no-require-imports */

function Stub({ label }: { label: string }) {
  return <Text>{label}</Text>;
}

const routes = {
  _layout: RootLayout,
  index: Index,
  '(auth)/_layout': { default: () => require('expo-router').Slot() },
  '(auth)/welcome': () => <Stub label="WELCOME SCREEN" />,
  '(auth)/staff-login': () => <Stub label="STAFF LOGIN" />,
  '(admin)/index': () => <Stub label="ADMIN" />,
  '(guard)/index': () => <Stub label="GUARD" />,
  '(resident)/index': () => <Stub label="RESIDENT" />,
  who: () => <Stub label="WHO" />,
  'no-access': () => <Stub label="NO ACCESS" />,
  'battery-guide': () => <Stub label="BATTERY" />,
};

function signedIn() {
  const { supabase } = jest.requireMock('@/lib/supabase');
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } } });
  return jest.requireMock('@/lib/postLogin').bootstrapSignedInUser as jest.Mock;
}

it('sends a signed-out user opening the app to the welcome screen', async () => {
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('WELCOME SCREEN')).toBeTruthy();
  expect(screen.queryByText(/unmatched/i)).toBeNull();
});

it('keeps a signed-in user off the welcome screen while their home loads', async () => {
  const bootstrap = signedIn();
  bootstrap.mockReturnValue(new Promise(() => {}));
  await renderRouter(routes, { initialUrl: '/' });
  await waitFor(() => expect(bootstrap).toHaveBeenCalledWith('u1'));
  expect(screen.queryByText('WELCOME SCREEN')).toBeNull();
  expect(screen.queryByText(/unmatched/i)).toBeNull();
});

it('asks a freshly signed-in resident who is using the phone', async () => {
  signedIn().mockResolvedValue({
    home: '/(resident)',
    needsActorName: true,
    showBatteryGuide: false,
    roles: ['resident'],
    pushStatus: 'ok',
  });
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('WHO')).toBeTruthy();
});

it('sends an admin to the admin home', async () => {
  signedIn().mockResolvedValue({
    home: '/(admin)',
    needsActorName: false,
    showBatteryGuide: false,
    roles: ['admin'],
    pushStatus: 'ok',
  });
  await renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByText('ADMIN')).toBeTruthy();
});
