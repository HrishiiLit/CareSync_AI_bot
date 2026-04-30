"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getPatient, listConditions, listMedications, listReports, updatePatient } from "@/services/api";
import { Button } from "@/components/ui/button";
import dynamic from 'next/dynamic';

const PdfUploadPreview = dynamic(() => import('@/components/pdf/PdfUploadPreview'), { ssr: false });

export default function PatientDetailsPage() {
  const params = useParams<{ id: string }>();
  const patientId = params?.id;

  const [patient, setPatient] = useState<any>(null);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [editingPhone, setEditingPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [conditions, setConditions] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!patientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      getPatient(patientId).catch(() => null),
      listConditions(patientId).catch(() => []),
      listMedications(patientId).catch(() => []),
      listReports(patientId).catch(() => []),
    ])
      .then(([p, c, m, r]) => {
        if (!mounted) return;
        setPatient(p);
        setConditions(Array.isArray(c) ? c : []);
        setMedications(Array.isArray(m) ? m : []);
        setReports(Array.isArray(r) ? r : []);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [patientId]);

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Patient Details</h1>
          <p className="text-sm text-muted-foreground">Overview of patient profile, conditions, medications, and reports.</p>
        </div>
        <Link href="/patients" className="text-sm font-medium text-primary hover:underline">
          Back to Patients
        </Link>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading patient data...</p> : null}

      {!loading && !patient ? (
        <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">Patient not found.</div>
      ) : null}

      {patient ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-medium">Profile</h2>
            <p className="mt-2 text-sm">Name: {patient.name ?? "Unknown"}</p>
            <p className="text-sm">Phone: {patient.phone ?? "Unknown"}</p>
            {isEditingPhone ? (
              <div className="mt-2 flex items-center gap-2">
                <input
                  aria-label="Edit phone"
                  className="input border bg-background px-2 py-1 text-sm rounded"
                  value={editingPhone}
                  onChange={(e) => setEditingPhone(e.target.value)}
                />
                <Button size="sm" onClick={async () => {
                  if (!patientId) return;
                  setSavingPhone(true);
                  try {
                    await updatePatient(patientId, { phone: editingPhone });
                    const refreshed = await getPatient(patientId).catch(() => null);
                    setPatient(refreshed);
                    setIsEditingPhone(false);
                  } catch (err) {
                    alert((err as any)?.message || "Failed to update phone");
                  } finally {
                    setSavingPhone(false);
                  }
                }}>
                  {savingPhone ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setIsEditingPhone(false); setEditingPhone(""); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{patient.phone ?? "Unknown"}</span>
                <Button size="sm" variant="ghost" onClick={() => { setEditingPhone(patient.phone ?? ""); setIsEditingPhone(true); }}>
                  Edit
                </Button>
              </div>
            )}
            <p className="text-sm">Email: {patient.email ?? "Not set"}</p>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-medium">Reports</h2>
            <p className="mt-2 text-sm text-muted-foreground">{reports.length} report(s) available.</p>
            {reports.slice(0, 5).map((report) => (
              <p key={report.id} className="mt-1 text-xs text-muted-foreground">
                {report.created_at ? new Date(report.created_at).toLocaleString() : "Unknown date"}
              </p>
            ))}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-medium">Conditions</h2>
            {conditions.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No conditions recorded.</p> : null}
            {conditions.slice(0, 10).map((item) => (
              <p key={item.id} className="mt-1 text-sm">{item.name ?? "Unnamed condition"}</p>
            ))}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-medium">Medications</h2>
            {medications.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No medications recorded.</p> : null}
            {medications.slice(0, 10).map((item) => (
              <p key={item.id} className="mt-1 text-sm">
                {item.name ?? "Medication"}
                {item.dosage ? ` (${item.dosage})` : ""}
              </p>
            ))}
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="font-medium">Import / Analyze PDF</h2>
            <PdfUploadPreview patientId={patientId} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
