export interface GroupableMessage {
  ts: number;
}

/**
 * Split a chronologically ordered list of messages into contiguous groups,
 * starting a new group whenever the gap between adjacent messages is ≥ gapMs.
 */
export function groupByGap<T extends GroupableMessage>(messages: T[], gapMs: number): T[][] {
  const out: T[][] = [];
  let current: T[] = [];
  let prevTs: number | null = null;
  for (const m of messages) {
    if (prevTs !== null && m.ts - prevTs >= gapMs) {
      if (current.length) out.push(current);
      current = [];
    }
    current.push(m);
    prevTs = m.ts;
  }
  if (current.length) out.push(current);
  return out;
}
