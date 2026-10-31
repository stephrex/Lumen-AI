import { idbGet, idbPut, STORE_SCENES } from "./database";
import type { SceneSnapshot } from "@/engines/context/scene-graph";

interface SceneRecord {
  sessionId: string;
  snapshot: SceneSnapshot;
  updatedAt: number;
}

export async function saveScene(sessionId: string, snapshot: SceneSnapshot): Promise<void> {
  try {
    await idbPut(STORE_SCENES, { sessionId, snapshot, updatedAt: Date.now() } satisfies SceneRecord);
  } catch {
    /* best-effort */
  }
}

export async function loadScene(sessionId: string): Promise<SceneSnapshot | null> {
  try {
    const rec = await idbGet<SceneRecord>(STORE_SCENES, sessionId);
    return rec?.snapshot ?? null;
  } catch {
    return null;
  }
}
