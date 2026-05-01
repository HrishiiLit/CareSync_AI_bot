"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocalAuth } from "@/lib/local-auth";
import { listCallLogs } from "@/services/api";

function getWebhookEntry(callLog: any) {
  const entries = Array.isArray(callLog?.execution_log) ? callLog.execution_log : [];
  return entries.find((step: any) => step?.node_id === "elevenlabs_webhook") ?? null;
}

type TranscriptLine = {
  speaker: string;
  message: string;
  timeLabel?: string;
  tone: "doctor" | "patient" | "system" | "unknown";
};

function parseTranscript(entry: any): TranscriptLine[] {
  const transcript = entry?.transcript;
  const lines: TranscriptLine[] = [];

  const pushLine = (speaker: string, message: string, timeLabel?: string) => {
    const normalizedSpeaker = speaker.trim();
    const lower = normalizedSpeaker.toLowerCase();
    const tone: TranscriptLine["tone"] =
      lower.includes("doctor") || lower.includes("clinician")
        ? "doctor"
        : lower.includes("patient")
          ? "patient"
          : lower.includes("system") || lower.includes("assistant") || lower.includes("agent")
            ? "system"
            : "unknown";

    lines.push({
      speaker: normalizedSpeaker || "Unknown",
      message: message.trim() || "(empty message)",
      timeLabel,
      tone,
    });
  };

  if (Array.isArray(transcript)) {
    transcript.forEach((item: any, index: number) => {
      if (typeof item === "string") {
        const raw = item.trim();
        const match = raw.match(/^\[(.*?)s\]\s*([^:]+):\s*(.*)$/);
        if (match) {
          pushLine(match[2], match[3], `${match[1]}s`);
          return;
        }
        const fallback = raw.match(/^([^:]+):\s*(.*)$/);
        if (fallback) {
          pushLine(fallback[1], fallback[2]);
          return;
        }
        pushLine(index % 2 === 0 ? "Patient" : "Doctor", raw);
        return;
      }

      if (item && typeof item === "object") {
        const speaker = item.role || item.speaker || item.sender || item.name || "Unknown";
        const message = item.message || item.text || item.content || "";
        const seconds = item.time_in_call_secs ?? item.time ?? item.timestamp;
        const timeLabel = seconds !== undefined && seconds !== null && seconds !== "" ? `${seconds}s` : undefined;
        pushLine(String(speaker), String(message), timeLabel);
      }
    });
    return lines;
  }

  if (typeof transcript === "string") {
    const rawLines = transcript.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    rawLines.forEach((line, index) => {
      const match = line.match(/^\[(.*?)s\]\s*([^:]+):\s*(.*)$/);
      if (match) {
        pushLine(match[2], match[3], `${match[1]}s`);
        return;
      }
      const fallback = line.match(/^([^:]+):\s*(.*)$/);
      if (fallback) {
        pushLine(fallback[1], fallback[2]);
        return;
      }
      pushLine(index % 2 === 0 ? "Patient" : "Doctor", line);
    });
  }

  return lines;
}

function speakerToneClasses(tone: TranscriptLine["tone"]) {
  if (tone === "doctor") return "border-primary/20 bg-primary/5 text-primary";
  if (tone === "patient") return "border-success/20 bg-success/5 text-success";
  if (tone === "system") return "border-muted-foreground/20 bg-muted/40 text-muted-foreground";
  return "border-border bg-background text-foreground";
}

type ExecutionLogStep = {
  title: string;
  nodeId: string;
  status: string;
  summary?: string;
  timeLabel?: string;
  accent: "success" | "warning" | "destructive" | "neutral";
  raw: any;
};

function stringifyPreview(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.length ? `Array(${value.length})` : "[]";
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== "")
      .slice(0, 3)
      .map(([key, entryValue]) => `${key}: ${stringifyPreview(entryValue)}`);
    return entries.length ? entries.join(" • ") : "{}";
  }
  return String(value);
}

function parseExecutionLog(executionLog: any): ExecutionLogStep[] {
  if (!Array.isArray(executionLog)) return [];

  return executionLog.map((entry: any, index: number) => {
    if (typeof entry === "string") {
      return {
        title: `Step ${index + 1}`,
        nodeId: "text-entry",
        status: "info",
        summary: entry,
        accent: "neutral",
        raw: entry,
      };
    }

    const title =
      entry?.title
      || entry?.name
      || entry?.node_name
      || entry?.node_id
      || entry?.step
      || `Step ${index + 1}`;
    const nodeId = String(entry?.node_id || entry?.nodeName || entry?.id || `step-${index + 1}`);
    const status = String(entry?.status || entry?.state || entry?.result || entry?.outcome || "unknown");
    const summary =
      entry?.message
      || entry?.summary
      || entry?.description
      || entry?.error
      || entry?.output
      || entry?.response
      || entry?.transcript
      || "";
    const timestamp = entry?.created_at || entry?.timestamp || entry?.time || entry?.completed_at;
    const duration = entry?.duration_ms || entry?.duration || entry?.elapsed_ms;
    const accent: ExecutionLogStep["accent"] = /fail|error|reject|cancel/i.test(status)
      ? "destructive"
      : /warn|partial|pending|running|processing/i.test(status)
        ? "warning"
        : /success|complete|done|ok/i.test(status)
          ? "success"
          : "neutral";
    const timeLabel = timestamp
      ? new Date(timestamp).toLocaleString()
      : duration !== undefined && duration !== null && duration !== ""
        ? `${duration}ms`
        : undefined;

    return {
      title: String(title),
      nodeId,
      status,
      summary: typeof summary === "string" ? summary.trim() : stringifyPreview(summary),
      timeLabel,
      accent,
      raw: entry,
    };
  });
}

function executionLogToneClasses(accent: ExecutionLogStep["accent"]) {
  if (accent === "success") return "border-success/20 bg-success/5 text-success";
  if (accent === "warning") return "border-amber-500/20 bg-amber-500/5 text-amber-700";
  if (accent === "destructive") return "border-destructive/20 bg-destructive/5 text-destructive";
  return "border-border bg-background text-foreground";
}

export default function CallsPage() {
  const { user } = useLocalAuth();
  const doctorId = user?.doctor_id ?? user?.sub;

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCallLogId, setSelectedCallLogId] = useState<string | null>(null);

  const selectedCallLog = useMemo(
    () => rows.find((row) => row.id === selectedCallLogId) ?? null,
    [rows, selectedCallLogId],
  );
  const selectedWebhookEntry = selectedCallLog ? getWebhookEntry(selectedCallLog) : null;
  const executionSteps = useMemo(
    () => parseExecutionLog(selectedCallLog?.execution_log),
    [selectedCallLog],
  );
  const transcriptLines = useMemo(() => parseTranscript(selectedWebhookEntry), [selectedWebhookEntry]);
  const transcriptText = selectedWebhookEntry?.transcript;
  const transcriptCount = transcriptLines.length;
  const executionStepCount = executionSteps.length;

  useEffect(() => {
    let mounted = true;
    if (!doctorId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    listCallLogs(undefined, doctorId)
      .then((data) => {
        if (!mounted) return;
        const nextRows = Array.isArray(data) ? data : [];
        setRows(nextRows);
        setSelectedCallLogId((current) => (current && nextRows.some((row) => row.id === current) ? current : nextRows[0]?.id ?? null));
      })
      .catch(() => {
        if (!mounted) return;
        setRows([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [doctorId]);

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Call Log</h1>
        <p className="text-sm text-muted-foreground">Recent workflow call executions.</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading call logs...</p> : null}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2">Call ID</th>
              <th className="px-3 py-2">Patient</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedCallLogId(row.id);
                  }
                }}
                className={`border-t cursor-pointer transition-colors hover:bg-muted/40 ${selectedCallLogId === row.id ? "bg-muted/50" : ""}`}
                onClick={() => setSelectedCallLogId(row.id)}
              >
                <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
                <td className="px-3 py-2">{row.patient_name ?? row.patient_id ?? "Unknown"}</td>
                <td className="px-3 py-2">{row.status ?? "unknown"}</td>
                <td className="px-3 py-2">{row.created_at ? new Date(row.created_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-muted-foreground" colSpan={4}>
                  No call logs found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selectedCallLog ? (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">Call Details</h2>
              <p className="text-xs text-muted-foreground">Expanded data captured from the workflow run and ElevenLabs webhook.</p>
            </div>
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelectedCallLogId(null)}>
              Clear selection
            </button>
          </div>

          <div className="grid gap-3 text-xs md:grid-cols-2">
            <DetailItem label="Patient" value={selectedCallLog.patient_name ?? selectedCallLog.patient_id ?? "Unknown"} />
            <DetailItem label="Status" value={selectedCallLog.status ?? "unknown"} />
            <DetailItem label="Outcome" value={selectedCallLog.outcome ?? "—"} />
            <DetailItem label="Created" value={selectedCallLog.created_at ? new Date(selectedCallLog.created_at).toLocaleString() : "—"} />
            <DetailItem label="Conversation ID" value={selectedWebhookEntry?.conversation_id ?? selectedCallLog.conversation_id ?? "—"} />
            <DetailItem label="Call SID" value={selectedWebhookEntry?.call_sid ?? selectedCallLog.call_sid ?? "—"} />
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transcript</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {transcriptCount > 0 ? `${transcriptCount} message${transcriptCount === 1 ? "" : "s"} captured` : "No transcript captured."}
                </p>
              </div>
              {transcriptCount > 0 ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Conversation timeline
                </div>
              ) : null}
            </div>

            {transcriptCount > 0 ? (
              <div className="mt-3 space-y-3 rounded-xl border bg-background p-3">
                {transcriptLines.map((line, index) => (
                  <div
                    key={`${line.speaker}-${index}-${line.timeLabel || "na"}`}
                    className={`rounded-lg border px-3 py-2 ${speakerToneClasses(line.tone)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold">{line.speaker}</p>
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                          {line.message}
                        </p>
                      </div>
                      {line.timeLabel ? (
                        <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                          {line.timeLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 rounded-lg border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
                This call has no transcript stored yet.
              </div>
            )}

            {typeof transcriptText === "string" && transcriptText.trim() ? (
              <details className="mt-3 rounded-lg border bg-muted/20 p-3">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">View raw transcript</summary>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/80">
                  {transcriptText}
                </pre>
              </details>
            ) : null}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Execution Log</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {executionStepCount > 0 ? `${executionStepCount} step${executionStepCount === 1 ? "" : "s"} recorded` : "No execution log captured."}
                </p>
              </div>
              {executionStepCount > 0 ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/30 px-3 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Workflow trace
                </div>
              ) : null}
            </div>

            {executionStepCount > 0 ? (
              <div className="mt-3 space-y-3">
                {executionSteps.map((step, index) => (
                  <div key={`${step.nodeId}-${index}`} className={`rounded-xl border p-3 ${executionLogToneClasses(step.accent)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold">{step.title}</p>
                          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {step.status}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">Node: {step.nodeId}</p>
                      </div>
                      {step.timeLabel ? (
                        <span className="shrink-0 rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
                          {step.timeLabel}
                        </span>
                      ) : null}
                    </div>

                    {step.summary ? (
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">{step.summary}</p>
                    ) : null}

                    <details className="mt-3 rounded-lg border border-border/70 bg-background/80 px-3 py-2">
                      <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                        View raw step data
                      </summary>
                      <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/80">
                        {JSON.stringify(step.raw, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 rounded-lg border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
                This call has no execution log stored yet.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-xs font-medium">{value}</p>
    </div>
  );
}
