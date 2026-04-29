"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLocalAuth } from "@/lib/local-auth";
import { listPatients } from "@/services/api";

type PatientRow = {
  id: string;
  name?: string;
  phone?: string;
  created_at?: string;
};

export default function PatientsPage() {
  const { user } = useLocalAuth();
  const doctorId = user?.doctor_id ?? user?.sub;

  const [rows, setRows] = useState<PatientRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!doctorId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    listPatients(doctorId)
      .then((data) => {
        if (!mounted) return;
        setRows(Array.isArray(data) ? (data as PatientRow[]) : []);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setRows([]);
        setError(err instanceof Error ? err.message : "Failed to load patients.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [doctorId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const name = (row.name ?? "").toLowerCase();
      const phone = (row.phone ?? "").toLowerCase();
      return name.includes(q) || phone.includes(q);
    });
  }, [rows, query]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Patients</h1>
          <p className="text-sm text-muted-foreground">Directory of patients linked to your account.</p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or phone"
          className="w-full rounded-md border px-3 py-2 text-sm md:w-72"
        />
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading patients...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && filtered.length === 0 ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">No patients found.</div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((row) => (
          <Link
            key={row.id}
            href={`/patients/${row.id}`}
            className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40"
          >
            <p className="font-medium">{row.name ?? "Unnamed patient"}</p>
            <p className="text-sm text-muted-foreground">{row.phone ?? "No phone"}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Added {row.created_at ? new Date(row.created_at).toLocaleString() : "Unknown"}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
