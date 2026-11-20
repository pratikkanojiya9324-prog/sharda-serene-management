jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { clearActorName, getActorName, setActorName } from './actor';

beforeEach(() => clearActorName());

describe('actor name', () => {
  it('is null until someone picks a name', async () => {
    expect(await getActorName()).toBeNull();
  });

  it('round-trips the stored name (trimmed)', async () => {
    await setActorName('  Rahul Sharma ');
    expect(await getActorName()).toBe('Rahul Sharma');
  });

  it('keeps at most 60 characters', async () => {
    await setActorName('x'.repeat(80));
    expect(await getActorName()).toBe('x'.repeat(60));
  });

  it('forgets the name when cleared or set to blank', async () => {
    await setActorName('Rahul');
    await clearActorName();
    expect(await getActorName()).toBeNull();
    await setActorName('Rahul');
    await setActorName('   ');
    expect(await getActorName()).toBeNull();
  });
});
