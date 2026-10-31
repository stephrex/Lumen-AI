"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadKokoro, kokoroReady, kokoroWav } from "@/lib/speech/kokoro";

/* --- Speech synthesis (spoken responses) -------------------------------- */

/** Rank available voices, preferring natural/neural ones. */
function pickBestVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
  const pool = en.length ? en : voices;
  const score = (v: SpeechSynthesisVoice) => {
    const n = `${v.name} ${v.voiceURI}`.toLowerCase();
    let s = 0;
    if (/natural|neural/.test(n)) s += 6;          // MS "… Online (Natural)"
    if (/google/.test(n)) s += 4;                  // Android/Chrome Google voices
    if (/aria|jenny|libby|sonia|guy|ryan|emma|michelle/.test(n)) s += 3;
    if (/samantha|daniel|serena|karen|moira/.test(n)) s += 2; // Apple
    if (/en-us|en-gb/i.test(v.lang)) s += 1;
    if (/compact|espeak|microsoft david|microsoft zira|microsoft mark/.test(n)) s -= 3;
    return s;
  };
  return [...pool].sort((a, b) => score(b) - score(a))[0];
}

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const srcRef = useRef<AudioBufferSourceNode | null>(null);
  const neuralOkRef = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("speechSynthesis" in window) {
      setSupported(true);
      const load = () => {
        const v = pickBestVoice(window.speechSynthesis.getVoices());
        if (v) voiceRef.current = v;
      };
      load();
      window.speechSynthesis.onvoiceschanged = load;
    }
    // Unlock an AudioContext on the first user gesture so neural audio can play
    // later without being blocked by mobile autoplay policies.
    const unlock = () => {
      try {
        if (!ctxRef.current) {
          const Ctor =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (Ctor) ctxRef.current = new Ctor();
        }
        void ctxRef.current?.resume?.();
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("touchstart", unlock);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.onvoiceschanged = null;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  const cancel = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    try {
      srcRef.current?.stop();
    } catch {
      /* already stopped */
    }
    srcRef.current = null;
    setSpeaking(false);
  }, []);

  const browserSpeak = useCallback((text: string, onEnd?: () => void) => {
    if (!("speechSynthesis" in window)) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.98;
    u.pitch = 1.05;
    const voice = voiceRef.current ?? pickBestVoice(window.speechSynthesis.getVoices());
    if (voice) u.voice = voice;
    u.onstart = () => setSpeaking(true);
    u.onend = () => {
      setSpeaking(false);
      onEnd?.();
    };
    u.onerror = () => {
      setSpeaking(false);
      onEnd?.();
    };
    window.speechSynthesis.speak(u);
  }, []);

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      cancel();
      if (!text.trim()) {
        onEnd?.();
        return;
      }
      const ctx = ctxRef.current;
      // Use the on-device Kokoro voice once it's loaded; until then (or on any
      // failure) speak instantly with the browser voice so there's no dead air.
      if (!neuralOkRef.current || !ctx || !kokoroReady()) {
        if (neuralOkRef.current && !kokoroReady()) {
          loadKokoro().catch(() => {
            neuralOkRef.current = false;
          });
        }
        browserSpeak(text, onEnd);
        return;
      }
      setSpeaking(true);
      kokoroWav(text)
        .then((buf) => ctx.decodeAudioData(buf))
        .then((audioBuf) => {
          void ctx.resume?.();
          const src = ctx.createBufferSource();
          src.buffer = audioBuf;
          src.connect(ctx.destination);
          src.onended = () => {
            setSpeaking(false);
            if (srcRef.current === src) srcRef.current = null;
            onEnd?.();
          };
          srcRef.current = src;
          src.start();
        })
        .catch(() => {
          browserSpeak(text, onEnd);
        });
    },
    [cancel, browserSpeak]
  );

  /** Begin downloading the on-device voice model (call on a user gesture). */
  const preloadVoice = useCallback(() => {
    loadKokoro().catch(() => {
      neuralOkRef.current = false;
    });
  }, []);

  return { speak, cancel, speaking, supported, preloadVoice };
}

/* --- Speech recognition (voice input) ----------------------------------- */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { [i: number]: { isFinal: boolean } } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

export function useSpeechRecognition(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    const Ctor =
      (typeof window !== "undefined" &&
        ((window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition)) ||
      null;
    if (!Ctor) return;
    setSupported(true);
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        const transcript = res[0]?.transcript ?? "";
        if ((res as { isFinal: boolean }).isFinal) finalText += transcript;
        else interimText += transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) {
        setInterim("");
        onFinalRef.current(finalText.trim());
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    return () => rec.abort();
  }, []);

  const start = useCallback(() => {
    if (!recRef.current) return;
    try {
      setInterim("");
      recRef.current.start();
      setListening(true);
    } catch {
      /* already started */
    }
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  return { start, stop, listening, interim, supported };
}
