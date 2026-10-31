import { idbGetAllByIndex, idbPut, STORE_OBSERVATIONS } from "./database";
import type { Observation } from "@/engines/context/observation-store";

export async function saveObservation(obs: Observation): Promise<void> {
  try {
    await idbPut(STORE_OBSERVATIONS, obs);
  } catch {
    /* best-effort */
  }
}

export async function listObservations(sessionId: string): Promise<Observation[]> {
  try {
    return await idbGetAllByIndex<Observation>(STORE_OBSERVATIONS, "bySession", sessionId);
  } catch {
    return [];
  }
}
