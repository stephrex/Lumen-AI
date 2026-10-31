/* Session-aware observation history — each analysis turn recorded with a
   timestamp. In-memory, mirrored to IndexedDB (see storage/). */

export interface Observation {
  id: string;
  sessionId: string;
  timestamp: number;
  mode: string;
  utterance: string;
  message: string;
  /** label list of what was seen, for quick scanning */
  labels: string[];
}

let seq = 0;
const uid = () => `obs_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export class ObservationStore {
  private items: Observation[] = [];

  add(o: Omit<Observation, "id">): Observation {
    const full: Observation = { ...o, id: uid() };
    this.items.push(full);
    return full;
  }

  list(): Observation[] {
    return [...this.items];
  }

  load(items: Observation[]): void {
    this.items = [...items].sort((a, b) => a.timestamp - b.timestamp);
  }

  clear(): void {
    this.items = [];
  }

  get count(): number {
    return this.items.length;
  }
}
