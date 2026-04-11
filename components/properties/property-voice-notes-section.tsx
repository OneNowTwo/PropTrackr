"use client";

import { Loader2, Mic, Square, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { createVoiceNote, deleteVoiceNote } from "@/app/actions/property-voice-notes";
import { Button } from "@/components/ui/button";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { VoiceNoteRow } from "@/lib/db/queries";
import { formatRelativeTime } from "@/lib/format-relative-time";

type Props = {
  propertyId: string;
  voiceNotes: VoiceNoteRow[];
};

/** Web Speech API (constructors vary by browser; types omitted for TS lib compatibility). */
type SpeechRecInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecEvent) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecEvent = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string } }>;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecInstance) | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & {
    SpeechRecognition?: new () => SpeechRecInstance;
    webkitSpeechRecognition?: new () => SpeechRecInstance;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function PropertyVoiceNotesSection({ propertyId, voiceNotes }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecInstance | null>(null);
  const transcriptRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognitionCtor()));
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const stopRecording = useCallback(async () => {
    setError(null);
    stopTimer();
    recognitionRef.current?.stop();
    recognitionRef.current = null;

    const mr = mediaRecorderRef.current;
    mediaRecorderRef.current = null;

    await new Promise<void>((resolve) => {
      if (!mr || mr.state === "inactive") {
        resolve();
        return;
      }
      mr.addEventListener("stop", () => resolve(), { once: true });
      mr.stop();
    });

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    setRecording(false);
    setSeconds(0);

    const mimeType = chunksRef.current[0]?.type || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];

    const draft = transcriptRef.current.trim();
    transcriptRef.current = "";

    if (!draft) {
      setError(
        "No speech detected. Use Chrome, allow microphone, and speak during recording.",
      );
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] ?? "" : "";

      const fd = new FormData();
      fd.append("propertyId", propertyId);
      fd.append("transcriptDraft", draft);
      fd.append("audioBase64", base64);
      fd.append("mimeType", mimeType);

      startTransition(async () => {
        const r = await createVoiceNote(fd);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        refresh();
      });
    };
    reader.readAsDataURL(blob);
  }, [propertyId, refresh, stopTimer]);

  const startRecording = useCallback(async () => {
    setError(null);
    transcriptRef.current = "";
    chunksRef.current = [];

    const SR = getSpeechRecognitionCtor();
    if (!SR) {
      setError("Speech recognition is not available in this browser. Try Chrome.");
      setSpeechSupported(false);
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access was denied or unavailable.");
      return;
    }
    streamRef.current = stream;

    const mimeCandidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ];
    const mimeType = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));

    const mr = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    mediaRecorderRef.current = mr;
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.start(400);

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-AU";
    recognition.onresult = (event: SpeechRecEvent) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        const r = event.results[i];
        if (r?.[0]?.transcript) text += r[0].transcript;
      }
      transcriptRef.current = text;
    };
    recognition.onerror = () => {
      /* ignore intermittent network/no-speech */
    };
    try {
      recognition.start();
    } catch {
      setError("Could not start speech recognition.");
      mr.stop();
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    recognitionRef.current = recognition;

    setSeconds(0);
    setRecording(true);
    timerRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  }, []);

  function onDelete(id: string) {
    if (!window.confirm("Delete this voice note?")) return;
    startTransition(async () => {
      await deleteVoiceNote(id);
      refresh();
    });
  }

  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  const timeLabel = `${mm}:${ss.toString().padStart(2, "0")}`;

  return (
    <Card className="border-[#E5E7EB] bg-white shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold text-[#111827]">
          Voice notes
        </CardTitle>
        {!speechSupported ? (
          <p className="text-sm text-amber-800">
            For best results use Chrome on desktop with microphone permission.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4">
          {!recording ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={startRecording}
                disabled={pending}
                className="gap-2 bg-[#0D9488] text-white hover:bg-[#0D9488]/90"
              >
                <Mic className="h-4 w-4" />
                Record
              </Button>
              <HelpTooltip
                title="Voice notes"
                content="Record a voice note during or after an inspection. AI transcribes it and extracts pros, cons and questions to ask the agent."
              />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm font-medium text-[#111827]">
                <span className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                Recording {timeLabel}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void stopRecording()}
                disabled={pending}
                className="gap-2 border-[#E5E7EB] bg-white"
              >
                <Square className="h-4 w-4 fill-current" />
                Stop
              </Button>
            </>
          )}
          {pending ? (
            <span className="flex items-center gap-2 text-sm text-[#6B7280]">
              <Loader2 className="h-4 w-4 animate-spin text-[#0D9488]" />
              Processing with AI…
            </span>
          ) : null}
        </div>

        <div className="space-y-4 border-t border-[#E5E7EB] pt-4">
          <h3 className="text-sm font-semibold text-[#111827]">Past voice notes</h3>
          {voiceNotes.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No voice notes yet.</p>
          ) : (
            <ul className="space-y-4">
              {voiceNotes.map((vn) => (
                <li
                  key={vn.id}
                  className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-xs font-medium text-[#6B7280]">
                      {formatRelativeTime(new Date(vn.createdAt))}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={pending}
                      onClick={() => onDelete(vn.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                  {vn.audioUrl.startsWith("data:") ? (
                    <audio
                      controls
                      src={vn.audioUrl}
                      className="mt-3 h-9 w-full max-w-md"
                    />
                  ) : null}
                  {vn.aiSummary ? (
                    <p className="mt-2 text-sm font-medium text-[#111827]">
                      {vn.aiSummary}
                    </p>
                  ) : null}
                  {vn.transcript ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                        Transcript
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[#111827]">
                        {vn.transcript}
                      </p>
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <VoiceListBlock title="Pros" items={vn.pros} tone="pro" />
                    <VoiceListBlock title="Cons" items={vn.cons} tone="con" />
                    <VoiceListBlock
                      title="Questions"
                      items={vn.questions}
                      tone="q"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function VoiceListBlock({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[] | null;
  tone: "pro" | "con" | "q";
}) {
  const list = items?.filter(Boolean) ?? [];
  const border =
    tone === "pro"
      ? "border-emerald-200"
      : tone === "con"
        ? "border-amber-200"
        : "border-[#E5E7EB]";
  return (
    <div className={`rounded-md border bg-white px-3 py-2 ${border}`}>
      <p className="text-xs font-semibold text-[#6B7280]">{title}</p>
      {list.length === 0 ? (
        <p className="mt-1 text-sm text-[#9CA3AF]">—</p>
      ) : (
        <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-[#111827]">
          {list.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
