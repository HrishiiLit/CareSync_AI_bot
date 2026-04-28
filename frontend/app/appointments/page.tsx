"use client";

import { useEffect, useState } from "react";
import { useLocalAuth } from "@/lib/local-auth";
import { listDoctorAppointments, updateDoctorAppointment, type DoctorAppointmentItem } from "@/services/api";

export default function AppointmentsPage() {
  const { user } = useLocalAuth();
  const doctorId = user?.sub;

  const [rows, setRows] = useState<DoctorAppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!doctorId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await listDoctorAppointments(doctorId);
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [doctorId]);

  const setStatus = async (appointmentId: string, status: string) => {
    if (!doctorId) return;
    try {
      await updateDoctorAppointment(appointmentId, { doctor_id: doctorId, status });
      await refresh();
    } catch {
      // ignore transient errors
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Appointments</h1>
        <p className="text-sm text-muted-foreground">Manage your scheduled visits.</p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading appointments...</p> : null}

      <div className="space-y-3">
        {rows.map((appt) => (
          <div key={appt.id} className="rounded-lg border bg-card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium">{appt.patient_name ?? "Unknown patient"}</p>
                <p className="text-sm text-muted-foreground">{appt.slot_start ? new Date(appt.slot_start).toLocaleString() : "No slot time"}</p>
                <p className="text-xs text-muted-foreground">Status: {appt.status}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setStatus(appt.id, "confirmed")} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">Confirm</button>
                <button type="button" onClick={() => setStatus(appt.id, "completed")} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">Complete</button>
                <button type="button" onClick={() => setStatus(appt.id, "cancelled")} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">Cancel</button>
              </div>
            </div>
          </div>
        ))}
        {!loading && rows.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">No appointments found.</div>
        ) : null}
      </div>
    </section>
  );
}
