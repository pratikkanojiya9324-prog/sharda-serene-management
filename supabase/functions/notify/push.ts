// Pure helpers for building Expo push messages (no network, no Deno APIs).

export type VisitRow = {
  id: string;
  name: string;
  purpose: string;
  status: string;
  pass_id: string | null;
};

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: { visitId: string; type: "visit_request" | "pass_used" };
  priority: "high";
  channelId: "visitor";
  sound: "default";
};

export function buildMessages(visit: VisitRow, tokens: string[]): ExpoMessage[] {
  const viaPass = visit.pass_id !== null;
  return tokens.map((to) => ({
    to,
    title: viaPass ? "Guest arrived" : "Visitor at gate",
    body: viaPass
      ? `${visit.name} entered using your pass`
      : `${visit.name} (${visit.purpose}) is at the gate`,
    data: { visitId: visit.id, type: viaPass ? "pass_used" : "visit_request" },
    priority: "high",
    channelId: "visitor",
    sound: "default",
  }));
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
