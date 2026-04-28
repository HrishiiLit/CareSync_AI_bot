"use client";

import { useEffect, useState } from "react";
import { useLocalAuth } from "@/lib/local-auth";
import { listCallLogs } from "@/services/api";

export default function CallsPage() {
  const { user } = useLocalAuth();
  const doctorId = user?.sub;

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        setRows(Array.isArray(data) ? data : []);
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
              <tr key={row.id} className="border-t">
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
    </section>
  );
}
