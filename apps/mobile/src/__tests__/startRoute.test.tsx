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

it('sends a signed-out user opening the app to the login screen', async () => {
  await renderRouter(
    {
      _layout: RootLayout,
      index: Index,
      '(auth)/_layout': { default: () => require('expo-router').Slot() },
      '(auth)/login': () => <Stub label="LOGIN SCREEN" />,
      '(auth)/verify': () => <Stub label="VERIFY" />,
      '(guard)/index': () => <Stub label="GUARD" />,
      '(resident)/index': () => <Stub label="RESIDENT" />,
      'no-access': () => <Stub label="NO ACCESS" />,
      'battery-guide': () => <Stub label="BATTERY" />,
    },
    { initialUrl: '/' },
  );
  expect(await screen.findByText('LOGIN SCREEN')).toBeTruthy();
  expect(screen.queryByText(/unmatched/i)).toBeNull();
});

it('keeps a signed-in user off the login screen while their home loads', async () => {
  const { supabase } = jest.requireMock('@/lib/supabase');
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } } });
  jest.requireMock('@/lib/postLogin').bootstrapSignedInUser.mockReturnValue(new Promise(() => {}));
  await renderRouter(
    {
      _layout: RootLayout,
      index: Index,
      '(auth)/_layout': { default: () => require('expo-router').Slot() },
      '(auth)/login': () => <Stub label="LOGIN SCREEN" />,
      '(guard)/index': () => <Stub label="GUARD" />,
    },
    { initialUrl: '/' },
  );
  await waitFor(() => expect(jest.requireMock('@/lib/postLogin').bootstrapSignedInUser).toHaveBeenCalledWith('u1'));
  expect(screen.queryByText('LOGIN SCREEN')).toBeNull();
  expect(screen.queryByText(/unmatched/i)).toBeNull();
});
