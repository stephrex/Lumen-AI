import type { AssistantResponse } from "@/types/assistant";
import type { NormBox } from "@/engines/vision/vision-types";

/* ---------------------------------------------------------------------------
   Scene graph — a structured, evolving representation of what LUMEN has seen.
   Objects persist identity across frames (matched by name), accrue observations,
   and carry an evidence status. Relationships are explicit and only added when
   the model provides them — we never invent physical relationships from mere
   proximity. In-memory here; persisted via IndexedDB (see storage/).
--------------------------------------------------------------------------- */

export type EvidenceStatus = "observed" | "inferred" | "user_confirmed" | "verified";

export type RelationKind =
  | "connected_to"
  | "part_of"
  | "located_near"
  | "attached_to"
  | "contains"
  | "interacts_with";

export interface SceneObject {
  id: string;
  name: string;
  category?: string;
  /** Gemma detection convention: 0..1000 [ymin,xmin,ymax,xmax]. */
  bbox?: { ymin: number; xmin: number; ymax: number; xmax: number };
  /** Normalised region (from Point-and-Ask) when there's no detection box. */
  region?: NormBox;
  confidence?: number;
  firstObservedAt: number;
  lastObservedAt: number;
  evidence: EvidenceStatus;
  observations: string[];
}

export interface Relationship {
  id: string;
  from: string; // object id
  to: string; // object id
  kind: RelationKind;
  evidence: EvidenceStatus;
  note?: string;
}

export interface SceneSnapshot {
  objects: SceneObject[];
  relationships: Relationship[];
  updatedAt: number;
}

let seq = 0;
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export class SceneGraph {
  private objects = new Map<string, SceneObject>();
  private relationships: Relationship[] = [];

  private norm(s: string) {
    return s.trim().toLowerCase();
  }
  private findByName(name: string): SceneObject | null {
    const n = this.norm(name);
    for (const o of this.objects.values()) if (this.norm(o.name) === n) return o;
    return null;
  }

  upsertObject(input: {
    name: string;
    category?: string;
    bbox?: SceneObject["bbox"];
    region?: NormBox;
    confidence?: number;
    observation?: string;
    evidence?: EvidenceStatus;
  }): SceneObject {
    const now = Date.now();
    let o = this.findByName(input.name);
    if (!o) {
      o = {
        id: uid("obj"),
        name: input.name,
        category: input.category,
        bbox: input.bbox,
        region: input.region,
        confidence: input.confidence,
        firstObservedAt: now,
        lastObservedAt: now,
        evidence: input.evidence ?? "observed",
        observations: [],
      };
      this.objects.set(o.id, o);
    } else {
      o.lastObservedAt = now;
      if (input.bbox) o.bbox = input.bbox;
      if (input.region) o.region = input.region;
      if (input.confidence != null) o.confidence = input.confidence;
      if (input.category) o.category = input.category;
      if (input.evidence === "user_confirmed" || input.evidence === "verified") o.evidence = input.evidence;
    }
    if (input.observation && !o.observations.includes(input.observation)) {
      o.observations.push(input.observation);
    }
    return o;
  }

  addRelationship(
    fromName: string,
    toName: string,
    kind: RelationKind,
    evidence: EvidenceStatus = "inferred",
    note?: string
  ): Relationship | null {
    const a = this.findByName(fromName);
    const b = this.findByName(toName);
    if (!a || !b || a.id === b.id) return null;
    const existing = this.relationships.find((r) => r.from === a.id && r.to === b.id && r.kind === kind);
    if (existing) return existing;
    const rel: Relationship = { id: uid("rel"), from: a.id, to: b.id, kind, evidence, note };
    this.relationships.push(rel);
    return rel;
  }

  confirmObject(id: string): void {
    const o = this.objects.get(id);
    if (o) o.evidence = "user_confirmed";
  }

  /** Fold a model response into the graph (optionally tied to a selected region). */
  ingest(resp: AssistantResponse, region?: NormBox): void {
    for (const b of resp.boxes ?? []) {
      this.upsertObject({
        name: b.label,
        bbox: { ymin: b.ymin, xmin: b.xmin, ymax: b.ymax, xmax: b.xmax },
        confidence: resp.confidence,
        observation: resp.message,
        evidence: "observed",
      });
    }
    if (region && (resp.boxes?.length ?? 0) === 0 && resp.observations?.[0]) {
      this.upsertObject({
        name: resp.observations[0].slice(0, 48),
        region,
        observation: resp.message,
        evidence: "observed",
      });
    }
    for (const r of resp.relationships ?? []) {
      this.addRelationship(r.from, r.to, r.kind as RelationKind, "inferred", r.note);
    }
  }

  snapshot(): SceneSnapshot {
    return {
      objects: [...this.objects.values()],
      relationships: [...this.relationships],
      updatedAt: Date.now(),
    };
  }

  load(s: SceneSnapshot): void {
    this.objects.clear();
    this.relationships = [];
    for (const o of s.objects) this.objects.set(o.id, o);
    this.relationships = [...s.relationships];
  }

  clear(): void {
    this.objects.clear();
    this.relationships = [];
  }

  get size(): number {
    return this.objects.size;
  }
}
