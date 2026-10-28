import type { RoomState, RoomVoiceMember } from "@ourdiu/shared/rooms";

/** "Voice calls are paused until 1 November". */
export function pausedUntil(state: RoomState) {
  if (!state.pausedUntil) return "Voice calls are paused for now";
  const date = new Date(`${state.pausedUntil}T00:00:00Z`).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    },
  );
  return `Voice calls are paused until ${date}`;
}

/** Talkers first, then the order they joined in. */
export function sortVoice(
  voice: RoomVoiceMember[],
  speaking: ReadonlySet<string>,
) {
  return [...voice].sort(
    (a, b) =>
      Number(speaking.has(b.id)) - Number(speaking.has(a.id)) ||
      Number(a.muted) - Number(b.muted),
  );
}

/** "4 in voice · 9 here · Nadia is talking". */
export function roomLine(
  state: RoomState,
  speaking: ReadonlySet<string> = new Set(),
  me?: string,
) {
  const parts = [];
  if (state.voice.length) parts.push(`${state.voice.length} in voice`);
  parts.push(`${state.here} here`);
  const talking = state.voice.filter((v) => speaking.has(v.id) && v.id !== me);
  if (talking.length === 1)
    parts.push(`${firstName(talking[0]!.name)} is talking`);
  else if (talking.length > 1) parts.push(`${talking.length} talking`);
  return parts.join(" · ");
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}
