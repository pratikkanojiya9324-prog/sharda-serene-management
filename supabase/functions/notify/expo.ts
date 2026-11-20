// Sends one batch to the Expo push API, retrying once on a network error or a
// non-2xx answer. Never throws: a failed batch is logged and reported.
import type { ExpoMessage } from "./push.ts";

export const EXPO_URL = "https://exp.host/--/api/v2/push/send";

export type ExpoTicket = { status: "ok" | "error"; details?: { error?: string } };
export type BatchResult = { ok: boolean; tickets: ExpoTicket[] };
type Fetch = (url: string, init: RequestInit) => Promise<Response>;
type Log = (...args: unknown[]) => void;

export async function sendBatch(
  batch: ExpoMessage[],
  fetchFn: Fetch = fetch,
  log: Log = console.log,
): Promise<BatchResult> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetchFn(EXPO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      const text = await res.text();
      if (!res.ok) {
        log(`expo push attempt ${attempt} failed: HTTP ${res.status}`, text);
        continue;
      }
      let body: { data?: ExpoTicket[] } | null = null;
      try {
        body = JSON.parse(text);
      } catch {
        body = null;
      }
      log("expo push", res.status, text);
      return { ok: true, tickets: body?.data ?? [] };
    } catch (e) {
      log(`expo push attempt ${attempt} error:`, e instanceof Error ? e.message : String(e));
    }
  }
  return { ok: false, tickets: [] };
}
