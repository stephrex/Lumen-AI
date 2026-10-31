import type { EvidenceStatus } from "./scene-graph";

/* Evidence classification helpers. Distinguishes directly observed facts,
   model inferences, user-confirmed information, and externally verified facts. */

export const EVIDENCE_RANK: Record<EvidenceStatus, number> = {
  inferred: 0,
  observed: 1,
  user_confirmed: 2,
  verified: 3,
};

export function strongerEvidence(a: EvidenceStatus, b: EvidenceStatus): EvidenceStatus {
  return EVIDENCE_RANK[a] >= EVIDENCE_RANK[b] ? a : b;
}

export function evidenceLabel(e: EvidenceStatus): string {
  const map: Record<EvidenceStatus, string> = {
    inferred: "Inferred",
    observed: "Observed",
    user_confirmed: "Confirmed",
    verified: "Verified",
  };
  return map[e];
}
