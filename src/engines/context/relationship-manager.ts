import type { RelationKind } from "./scene-graph";

/* Allowed relationship kinds + a guard so we only accept known relations from
   the model (anything else is dropped rather than invented). */
export const RELATION_KINDS: RelationKind[] = [
  "connected_to",
  "part_of",
  "located_near",
  "attached_to",
  "contains",
  "interacts_with",
];

export function isRelationKind(x: string): x is RelationKind {
  return (RELATION_KINDS as string[]).includes(x);
}

export function relationLabel(kind: RelationKind): string {
  return kind.replace(/_/g, " ");
}
