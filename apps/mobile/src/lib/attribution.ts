// "Who did it" text built from the *_name columns (the "who's using this phone"
// name sent as p_actor_name) and the flat label.

/** "Rahul (B1-A-101)"; just the flat when no name was given. */
export function actorLabel(name: string | null | undefined, flat: string | null | undefined): string {
  const who = name?.trim();
  if (who && flat) return `${who} (${flat})`;
  return who || flat || 'Your flat';
}

/**
 * Comment author. Every family member signs in as the flat account, so a
 * comment is "ours" when its author is the signed-in user; anyone else on a
 * complaint thread is the society office (admins).
 */
export function commentAuthor(
  comment: { author_id: string | null; author_name: string | null },
  myUserId: string | null,
  flat: string | null,
): { name: string; mine: boolean } {
  const mine = myUserId !== null && comment.author_id === myUserId;
  if (mine) return { name: actorLabel(comment.author_name, flat), mine };
  return { name: comment.author_name?.trim() || 'Society office', mine };
}
