"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraOff, AlertTriangle, Loader2, Eye, Languages, X, AudioLines, Zap } from "lucide-react";
import { AiEngine, type EngineStatus } from "@/lib/ai/engine";
import type { AssistantResponse, LumenMode } from "@/types/assistant";
import type { LumenState } from "@/lib/states";
import { useCamera } from "@/hooks/useCamera";
import { useSpeechSynthesis, useSpeechRecognition } from "@/hooks/useSpeech";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { VoiceOrb } from "@/components/VoiceOrb";
import { Captions } from "@/components/Captions";
import { ControlBar } from "@/components/ControlBar";
import { VisualPanel } from "@/components/VisualPanel";
import { ProcessingBadge } from "@/components/StatusBadge";
import { DownloadOverlay } from "@/components/DownloadOverlay";
import { AnnotatedFrame } from "@/components/AnnotatedFrame";
import { SuggestionChips } from "@/components/SuggestionChips";
import { Hud } from "@/components/Hud";
import { FrameManager } from "@/engines/vision/frame-manager";
import { captureFrame } from "@/engines/vision/frame-capture";
import { screenToFrame, cropRegion } from "@/engines/vision/region-selector";
import { loadImage } from "@/engines/vision/image-preprocessor";
import type { RegionSelection } from "@/engines/vision/vision-types";
import { MediaPipeVisionProvider } from "@/engines/vision/providers/mediapipe-vision-provider";
import { loadScene } from "@/storage/indexeddb/scene-repository";
import { listObservations } from "@/storage/indexeddb/observation-repository";
import type { SceneSnapshot } from "@/engines/context/scene-graph";
import { SceneGraph } from "@/engines/context/scene-graph";
import { ObservationStore } from "@/engines/context/observation-store";
import { saveScene } from "@/storage/indexeddb/scene-repository";
import { saveObservation } from "@/storage/indexeddb/observation-repository";

const MODE_LABEL: Record<LumenMode, string> = { explore: "Explore", learn: "Learn", fix: "Do / Fix" };

export default function LumenApp() {
  const engineRef = useRef<AiEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AiEngine();
  const engine = engineRef.current;

  // Vision/context engines (persist across renders)
  const frameManagerRef = useRef<FrameManager | null>(null);
  if (!frameManagerRef.current) frameManagerRef.current = new FrameManager(3000, 10);
  const sceneGraphRef = useRef<SceneGraph | null>(null);
  if (!sceneGraphRef.current) sceneGraphRef.current = new SceneGraph();
  const observationStoreRef = useRef<ObservationStore | null>(null);
  if (!observationStoreRef.current) observationStoreRef.current = new ObservationStore();
  const visionProviderRef = useRef<MediaPipeVisionProvider | null>(null);
  if (!visionProviderRef.current) visionProviderRef.current = new MediaPipeVisionProvider();
  const sessionIdRef = useRef<string>("");

  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [phase, setPhase] = useState<"welcome" | "session">("welcome");
  const [mode, setMode] = useState<LumenMode>("explore");
  const [state, setState] = useState<LumenState>("IDLE");
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [caption, setCaption] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [frozen, setFrozen] = useState<string | null>(null);
  const [selection, setSelection] = useState<RegionSelection | null>(null);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [ambient, setAmbient] = useState(false);
  const [resume, setResume] = useState<{ sessionId: string; count: number; snapshot: SceneSnapshot } | null>(null);
  const [download, setDownload] = useState({ open: false, progress: 0, note: "", error: null as string | null });

  const camera = useCamera();
  const tts = useSpeechSynthesis();
  const historyRef = useRef<{ role: "user" | "assistant"; text: string }[]>([]);

  // keep refs so speech-recognition callback sees latest values
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const statusRef = useRef(status);
  statusRef.current = status;
  const frozenRef = useRef<string | null>(null);
  frozenRef.current = frozen;
  const selectionRef = useRef<RegionSelection | null>(null);
  selectionRef.current = selection;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    engine.prepare().then(setStatus);
  }, [engine]);

  /* --- restore-on-return: offer to resume the last persisted session ----- */
  const refreshResume = useCallback(async () => {
    try {
      const last = localStorage.getItem("lumen:lastSession");
      if (!last) {
        setResume(null);
        return;
      }
      const snap = await loadScene(last);
      if (snap && snap.objects.length > 0) {
        setResume({ sessionId: last, count: snap.objects.length, snapshot: snap });
      } else {
        setResume(null);
      }
    } catch {
      setResume(null);
    }
  }, []);

  useEffect(() => {
    void refreshResume();
  }, [refreshResume]);

  /* --- one conversational turn ---------------------------------------- */
  const runTurn = useCallback(
    async (
      utterance: string,
      opts?: {
        image?: string;
        fresh?: boolean;
        noFreeze?: boolean;
        frameHash?: string;
        selection?: RegionSelection;
      }
    ) => {
      tts.cancel();
      const fm = frameManagerRef.current!;
      const sg = sceneGraphRef.current!;
      const os = observationStoreRef.current!;
      const s = statusRef.current;
      const canSee = s?.cloudConfigured || !s?.localEnabled;
      const freshFrame = canSee && camera.status === "live" ? camera.capture() ?? undefined : undefined;
      const frozenNow = frozenRef.current;

      // A selection comes either explicitly (new tap) or persists from an active
      // Point-and-Ask so follow-ups keep discussing that region.
      const selection = opts?.selection ?? (selectionRef.current ?? undefined);

      // Context frame: fresh for a new scan/selection, else reuse the frozen one.
      const imageDataUrl =
        opts?.image ?? (opts?.fresh || opts?.selection ? freshFrame : frozenNow ?? freshFrame);

      if (imageDataUrl) {
        setState("OBSERVING");
        if (!opts?.noFreeze && imageDataUrl !== frozenNow) setFrozen(imageDataUrl);
      }

      setState("THINKING");
      historyRef.current.push({ role: "user", text: utterance });

      const signal = fm.begin(opts?.frameHash);
      const myController = fm.controller;
      try {
        const { response: res } = await engine.respond(
          {
            mode: modeRef.current,
            utterance,
            imageDataUrl,
            selection: selection
              ? { cropDataUrl: selection.cropDataUrl, point: selection.point }
              : undefined,
            history: historyRef.current.slice(-6),
          },
          signal
        );
        setResponse(res);
        setStatus({ ...engine.status });
        historyRef.current.push({ role: "assistant", text: res.message });
        setCaption(res.message);

        // Fold the result into the scene graph + observation store, then persist.
        sg.ingest(res, selection?.box);
        const obs = os.add({
          sessionId: sessionIdRef.current,
          timestamp: Date.now(),
          mode: modeRef.current,
          utterance,
          message: res.message,
          labels: (res.boxes ?? []).map((b) => b.label),
        });
        void saveScene(sessionIdRef.current, sg.snapshot());
        void saveObservation(obs);

        if (modeRef.current === "fix" && res.task_update?.steps.length) setPanelOpen(true);

        const guiding = modeRef.current === "fix";
        setState("SPEAKING");
        tts.speak(res.speech_text, () => setState(guiding ? "GUIDING" : "IDLE"));
        if (!tts.supported) setState(guiding ? "GUIDING" : "IDLE");
      } catch (e) {
        // A superseded/cancelled request is not an error — just stop quietly.
        if ((e as Error)?.name === "AbortError" || signal.aborted) return;
        setCaption((e as Error)?.message || "Something went wrong.");
        setState("ERROR");
      } finally {
        if (fm.controller === myController) fm.end();
      }
    },
    [camera, engine, tts]
  );
  const runTurnRef = useRef(runTurn);
  runTurnRef.current = runTurn;

  /* --- voice input ----------------------------------------------------- */
  const handleUtterance = useCallback((text: string) => {
    const lower = text.toLowerCase();
    if (/^(stop|pause|be quiet)\b/.test(lower)) {
      window.speechSynthesis?.cancel();
      setState("IDLE");
      return;
    }
    if (/\b(show me|show it|open (the )?diagram)\b/.test(lower)) {
      setPanelOpen(true);
      return;
    }
    if (/\b(go back|close|hide)\b/.test(lower)) {
      setPanelOpen(false);
      return;
    }
    runTurnRef.current(text);
  }, []);

  const recog = useSpeechRecognition(handleUtterance);

  useEffect(() => {
    if (recog.listening) setState("LISTENING");
  }, [recog.listening]);

  /* --- ambient "it's alive" mode: glance via the frame pipeline ---------- */
  useEffect(() => {
    if (!ambient || phase !== "session") return;
    const id = setInterval(() => {
      const fm = frameManagerRef.current!;
      const video = camera.videoRef.current;
      if (!video) return;
      // Only glance when idle, not mid-interaction, not showing a snapshot,
      // respecting cooldown, and skipping near-duplicate frames.
      if (stateRef.current !== "IDLE" && stateRef.current !== "GUIDING") return;
      if (frozenRef.current || !fm.canRun()) return;
      const frame = captureFrame(video);
      if (!frame || fm.isDuplicate(frame.hash)) return;
      runTurnRef.current(
        "Glance at the scene. In ONE short sentence, note the single most interesting or relevant thing you notice.",
        { image: frame.dataUrl, noFreeze: true, frameHash: frame.hash }
      );
    }, 7000);
    return () => clearInterval(id);
  }, [ambient, phase, camera]);

  /* --- session lifecycle ---------------------------------------------- */
  const startSession = useCallback(
    (m: LumenMode, resumeData?: { sessionId: string; snapshot: SceneSnapshot }) => {
      setMode(m);
      setPhase("session");
      setResponse(null);
      setCaption("");
      setFrozen(null);
      setSelection(null);
      setMaskDataUrl(null);
      historyRef.current = [];
      frameManagerRef.current?.cancel();

      if (resumeData) {
        // Restore-on-return: continue a prior session with its scene graph.
        sessionIdRef.current = resumeData.sessionId;
        sceneGraphRef.current?.load(resumeData.snapshot);
        listObservations(resumeData.sessionId)
          .then((obs) => observationStoreRef.current?.load(obs))
          .catch(() => {});
      } else {
        sessionIdRef.current = `s_${Date.now().toString(36)}`;
        sceneGraphRef.current?.clear();
        observationStoreRef.current?.clear();
      }
      try {
        localStorage.setItem("lumen:lastSession", sessionIdRef.current);
      } catch {
        /* ignore */
      }

      camera.start();
      tts.preloadVoice(); // begin downloading the on-device voice model
      setState("IDLE");
    },
    [camera, tts]
  );

  const endSession = useCallback(() => {
    tts.cancel();
    recog.stop();
    camera.stop();
    frameManagerRef.current?.cancel();
    setPhase("welcome");
    setState("IDLE");
    setPanelOpen(false);
    setFrozen(null);
    setSelection(null);
    setMaskDataUrl(null);
    void refreshResume();
  }, [camera, tts, recog, refreshResume]);

  /* --- Point-and-Ask: tap the camera to select & ask about a region ----- */
  const onCanvasTap = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const video = camera.videoRef.current;
      if (!video || camera.status !== "live") return;
      const pt = screenToFrame(video, e.clientX, e.clientY, camera.facing === "user");
      if (!pt) return;
      const sel = cropRegion(video, pt);
      if (!sel) return;
      const full = camera.capture() ?? undefined;
      setSelection(sel);
      setMaskDataUrl(null);
      if (full) setFrozen(full);
      // Gemma explains the region (primary path)…
      runTurnRef.current("What is this? Identify and explain this specific part.", {
        selection: sel,
        image: full,
      });
      // …and on-device MediaPipe adds a segmentation highlight + enriches the
      // scene graph with generic detections (best-effort; silent if unavailable).
      if (full) {
        (async () => {
          try {
            const vp = visionProviderRef.current!;
            if (!vp.ready()) await vp.init();
            const img = await loadImage(full);
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            const seg = await vp.segmentAtPoint?.(img, sel.point, w, h);
            if (seg?.maskDataUrl) setMaskDataUrl(seg.maskDataUrl);
            const det = await vp.detect?.(img, w, h);
            if (det?.detections?.length) {
              const sg = sceneGraphRef.current!;
              for (const d of det.detections) {
                sg.upsertObject({
                  name: d.label,
                  confidence: d.score,
                  region: d.box,
                  evidence: "observed",
                  observation: "on-device detection",
                });
              }
              void saveScene(sessionIdRef.current, sg.snapshot());
            }
          } catch {
            /* best-effort — Gemma already answered */
          }
        })();
      }
    },
    [camera]
  );

  const onMic = useCallback(() => {
    if (recog.listening) {
      recog.stop();
      setState("IDLE");
    } else if (recog.supported) {
      tts.cancel();
      recog.start();
    } else {
      // No speech recognition — still let them trigger a turn.
      runTurnRef.current("What am I looking at?");
    }
  }, [recog, tts]);

  // Drill into a specific detected object / diagram part, reusing the frozen frame.
  const drillInto = useCallback((label: string) => {
    runTurnRef.current(`Tell me more about the ${label} — explain it in detail.`, {
      image: frozenRef.current ?? undefined,
    });
  }, []);

  const onPauseResume = useCallback(() => {
    if (camera.status === "paused") {
      camera.resume();
      setState("IDLE");
    } else {
      camera.pause();
      setState("PAUSED");
    }
  }, [camera]);

  const toggleStep = useCallback((id: string) => {
    setResponse((prev) => {
      if (!prev?.task_update) return prev;
      const steps = prev.task_update.steps.map((s) =>
        s.id === id ? { ...s, status: s.status === "done" ? "pending" : "done" } : s
      ) as typeof prev.task_update.steps;
      return { ...prev, task_update: { ...prev.task_update, steps } };
    });
  }, []);

  const enableLocal = useCallback(async () => {
    setDownload({ open: true, progress: 0, note: "Starting…", error: null });
    try {
      await engine.enableLocal((p, note) => setDownload((d) => ({ ...d, progress: p, note })));
      setStatus({ ...engine.status });
      setDownload({ open: false, progress: 1, note: "", error: null });
    } catch (e) {
      setDownload((d) => ({ ...d, error: (e as Error)?.message || "Download failed." }));
    }
  }, [engine]);

  /* --- render ---------------------------------------------------------- */
  if (phase === "welcome") {
    return (
      <>
        <WelcomeScreen
          status={status}
          onStart={startSession}
          onEnableLocal={enableLocal}
          resume={resume ? { count: resume.count } : null}
          onResume={(m) => resume && startSession(m, { sessionId: resume.sessionId, snapshot: resume.snapshot })}
        />
        <DownloadOverlay
          {...download}
          onCancel={() => setDownload({ open: false, progress: 0, note: "", error: null })}
        />
      </>
    );
  }

  const live = camera.status === "live" || camera.status === "paused";

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg-0">
      {/* camera layer */}
      <video
        ref={camera.videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: camera.facing === "user" ? "scaleX(-1)" : undefined }}
      />
      {/* vignette for legibility */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,transparent_40%,rgba(5,6,10,0.55))]" />

      {/* Point-and-Ask: tap anywhere on the live camera to select a region */}
      {live && camera.status === "live" && !frozen && (
        <div
          className="absolute inset-0 z-[8]"
          onPointerDown={onCanvasTap}
          aria-label="Tap to ask about a region"
        />
      )}

      {/* futuristic HUD frame */}
      {live && <Hud state={state} model="GEMMA-4 · LUMEN" />}

      {/* analysed frame with Gemma's object labels (and tapped region) drawn on it */}
      {frozen && (
        <AnnotatedFrame
          src={frozen}
          boxes={response?.boxes ?? []}
          selection={selection}
          maskDataUrl={maskDataUrl}
          analysing={state === "OBSERVING" || state === "THINKING"}
          onTapBox={drillInto}
          onResume={() => {
            setFrozen(null);
            setSelection(null);
            setMaskDataUrl(null);
          }}
        />
      )}

      {/* camera fallbacks */}
      {!live && (
        <div className="lumen-ambient absolute inset-0 grid place-items-center px-8 text-center">
          {camera.status === "requesting" && (
            <div className="flex flex-col items-center gap-3 text-ink-dim">
              <Loader2 className="animate-spin text-accent" />
              <p className="text-sm">Requesting camera…</p>
            </div>
          )}
          {camera.status === "denied" && (
            <FallbackCard
              icon={<CameraOff className="text-[var(--warn)]" />}
              title="Camera permission denied"
              body="LUMEN needs the camera to see what you're showing it. Enable it in your browser's site settings, then retry."
              action={{ label: "Retry camera", onClick: camera.start }}
            />
          )}
          {(camera.status === "unavailable" || camera.status === "error") && (
            <FallbackCard
              icon={<AlertTriangle className="text-[var(--danger)]" />}
              title="Camera unavailable"
              body={camera.error || "No usable camera was found on this device. You can still talk to LUMEN in demo mode."}
              action={{ label: "Continue anyway", onClick: () => runTurnRef.current("Introduce yourself.") }}
              demo
            />
          )}
        </div>
      )}

      {/* processing-state scanline while observing/thinking */}
      {(state === "OBSERVING" || state === "THINKING") && live && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="scanline" />
        </div>
      )}

      {/* top bar */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight text-gradient">LUMEN</span>
          <span className="rounded-full glass px-2 py-0.5 text-[11px] text-ink-dim">{MODE_LABEL[mode]}</span>
        </div>
        <div className="flex items-center gap-2">
          <ProcessingBadge mode={response?.processing_mode ?? null} />
          {ambient && (
            <span className="mono inline-flex items-center gap-1.5 rounded-full glass px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-[var(--ok)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--ok)]" style={{ animation: "caret-blink 1.4s infinite" }} />
              Ambient
            </span>
          )}
          <button onClick={endSession} aria-label="End session" className="ctrl !h-9 !w-9 btn-ghost">
            <X size={16} />
          </button>
        </div>
      </header>

      {/* side tool rail: ambient + read/translate */}
      {live && (
        <div className="absolute left-3 top-24 z-20 flex flex-col gap-2">
          <button
            onClick={() => setAmbient((a) => !a)}
            aria-label="Toggle ambient mode"
            className="ctrl !h-11 !w-11"
            style={{
              background: ambient ? "linear-gradient(100deg,#43d6a0,#5b8cff)" : "rgba(255,255,255,0.05)",
              border: "1px solid var(--line-strong)",
              color: ambient ? "white" : "var(--ink-dim)",
            }}
          >
            <Eye size={18} />
          </button>
          <button
            onClick={() =>
              runTurnRef.current(
                "Read any text you can see. If it isn't English, translate it to English. Put a box around each text region and label it with the (translated) text.",
                { fresh: true }
              )
            }
            aria-label="Read and translate text"
            className="ctrl !h-11 !w-11 btn-ghost"
            disabled={state === "THINKING" || state === "OBSERVING"}
          >
            <Languages size={18} />
          </button>
          <button
            onClick={() => tts.setNaturalVoice(!tts.naturalVoice)}
            aria-label="Toggle voice: fast or natural"
            className="ctrl !h-11 !w-11 btn-ghost"
            title={tts.naturalVoice ? "Natural voice (on-device)" : "Fast voice"}
          >
            {tts.naturalVoice ? (
              <AudioLines size={18} className="text-accent" />
            ) : (
              <Zap size={18} className="text-[var(--warn)]" />
            )}
          </button>
        </div>
      )}

      {/* floating orb — hidden while a snapshot is in focus */}
      {!frozen && (
        <div className="pointer-events-none absolute left-1/2 top-[18%] z-10 -translate-x-1/2">
          <VoiceOrb state={state} size={128} />
        </div>
      )}

      {/* bottom stack: caption + suggestion chips (never overlap) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-28 z-20 flex flex-col items-center gap-2.5 px-4">
        <Captions speech={caption} interim={recog.interim} speaking={state === "SPEAKING"} />
        {response && !panelOpen && state !== "LISTENING" && (
          <SuggestionChips
            response={response}
            mode={mode}
            disabled={state === "THINKING" || state === "OBSERVING"}
            onPick={(t) => runTurnRef.current(t)}
          />
        )}
      </div>

      {/* safety banner */}
      {response?.safety && response.safety.level !== "none" && (
        <div className="absolute inset-x-4 top-16 z-20 mx-auto max-w-md animate-float-up">
          <div
            className="flex items-start gap-2 rounded-xl glass-strong p-3 text-xs"
            style={{ color: response.safety.level === "danger" ? "var(--danger)" : "var(--warn)" }}
          >
            <AlertTriangle size={15} className="mt-0.5 shrink-0" />
            <span>{response.safety.message}</span>
          </div>
        </div>
      )}

      <VisualPanel
        response={response}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onToggleStep={toggleStep}
        onNodeTap={drillInto}
      />

      <ControlBar
        listening={recog.listening}
        paused={camera.status === "paused"}
        thinking={state === "THINKING" || state === "OBSERVING"}
        canSwitchCamera={camera.hasMultipleCameras}
        hasVisual={!!(response?.visual || response?.task_update?.steps.length)}
        onMic={onMic}
        onAnalyse={() => {
          setSelection(null);
          setMaskDataUrl(null);
          runTurnRef.current("What am I looking at? Identify and label the key objects and explain.", { fresh: true });
        }}
        onToggleVisual={() => setPanelOpen((o) => !o)}
        onPauseResume={onPauseResume}
        onSwitchCamera={camera.switchCamera}
      />
    </main>
  );
}

function FallbackCard({
  icon,
  title,
  body,
  action,
  demo,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: { label: string; onClick: () => void };
  demo?: boolean;
}) {
  return (
    <div className="glass-strong w-full max-w-sm rounded-3xl p-6 text-center">
      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white/5">{icon}</div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm text-ink-dim">{body}</p>
      <button onClick={action.onClick} className={`btn mt-5 h-11 w-full ${demo ? "btn-ghost" : "btn-primary"}`}>
        {action.label}
      </button>
      {demo && <p className="mt-2 text-[11px] text-[var(--warn)]">Runs in labelled demo mode.</p>}
    </div>
  );
}
