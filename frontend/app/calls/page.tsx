"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocalAuth } from "@/lib/local-auth";
import { listCallLogs } from "@/services/api";

function getWebhookEntry(callLog: any) {
  const entries = Array.isArray(callLog?.execution_log) ? callLog.execution_log : [];
  return entries.find((step: any) => step?.node_id === "elevenlabs_webhook") ?? null;
}

function formatWebhookTranscript(entry: any) {
  const transcript = entry?.transcript;
  if (typeof transcript === "string") return transcript;
  if (Array.isArray(transcript)) return transcript.map((line: any) => (typeof line === "string" ? line : JSON.stringify(line, null, 2))).join("\n");
  return "No transcript captured.";
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
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transcript</p>
            <pre className="mt-2 max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
              {formatWebhookTranscript(selectedWebhookEntry)}
            </pre>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Execution Log</p>
            <pre className="mt-2 max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
              {JSON.stringify(selectedCallLog.execution_log ?? [], null, 2)}
            </pre>
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
