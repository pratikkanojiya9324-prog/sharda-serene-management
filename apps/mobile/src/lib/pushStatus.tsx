import { createContext, useContext } from 'react';

import type { PushStatus } from './push';

/** Push registration result for the signed-in user; null until known. */
export const PushStatusContext = createContext<PushStatus | null>(null);

export function usePushStatus(): PushStatus | null {
  return useContext(PushStatusContext);
}
