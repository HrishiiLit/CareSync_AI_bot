"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocalAuth } from "@/lib/local-auth";
import { listCallLogs, listWorkflows } from "@/services/api";

type AuditEvent = {
  id: string;
  type: string;
  description: string;
  timestamp: string;
};

export default function AuditLogPage() {
  const { user } = useLocalAuth();
  const doctorId = user?.sub;

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!doctorId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      listCallLogs(undefined, doctorId).catch(() => []),
      listWorkflows(doctorId).catch(() => []),
    ])
      .then(([callLogs, workflows]) => {
        if (!mounted) return;

        const callEvents: AuditEvent[] = (Array.isArray(callLogs) ? callLogs : []).map((row: any) => ({
          id: `call-${row.id}`,
          type: "call_log",
          description: `Call ${row.status ?? "updated"} for patient ${row.patient_id ?? "unknown"}`,
          timestamp: row.created_at ?? new Date().toISOString(),
        }));

        const workflowEvents: AuditEvent[] = (Array.isArray(workflows) ? workflows : []).map((row: any) => ({
          id: `workflow-${row.id}`,
          type: "workflow",
          description: `Workflow ${row.name ?? row.id} is ${row.status ?? "updated"}`,
          timestamp: row.updated_at ?? row.created_at ?? new Date().toISOString(),
        }));

        setEvents([...callEvents, ...workflowEvents]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [doctorId]);

  const sorted = useMemo(
    () => [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [events],
  );

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-muted-foreground">Timeline of workflow and call activity.</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading events...</p> : null}

      <div className="space-y-2">
        {sorted.map((event) => (
          <div key={event.id} className="rounded-lg border bg-card p-4">
            <p className="text-sm font-medium">{event.description}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{event.type}</p>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</p>
          </div>
        ))}

        {!loading && sorted.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">No audit events found.</div>
        ) : null}
      </div>
    </section>
  );
}
