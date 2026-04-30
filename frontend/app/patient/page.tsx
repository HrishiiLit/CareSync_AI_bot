"use client";

import Link from "next/link";
import { useLocalAuth } from "@/lib/local-auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RoleMismatchState } from "@/components/RoleMismatchState";
import {
  cancelPatientPortalAppointment,
  listDoctors,
  listDoctorFeedback,
  listReports,
  registerPatientPortal,
  getPatientPortalMe,
  listPatientPortalAppointments,
  type DoctorListItem,
  type DoctorFeedbackItem,
  type PatientPortalAppointment,
  type PatientPortalProfile,
  type ReportItem,
} from "@/services/api";
import { Button } from "@/components/ui/button";
import { CalendarClock, FileText, Loader2 } from "lucide-react";
import FeedbackForm from "@/components/FeedbackForm";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function PatientPortalPage() {
  const { user, isLoading, isAuthenticated, logout } = useLocalAuth();

  const [profile, setProfile] = useState<PatientPortalProfile | null>(null);
  const [appointments, setAppointments] = useState<PatientPortalAppointment[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [feedbackByDoctor, setFeedbackByDoctor] = useState<Record<string, DoctorFeedbackItem[]>>({});
  const [feedbackDoctorId, setFeedbackDoctorId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState("");

  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const authUserId = user?.sub ?? "";

  const loadDoctors = useCallback(async () => {
    const rows = await listDoctors();
    setDoctors(rows);

    if (rows.length > 0) {
      const feedbackPairs = await Promise.all(
        rows.map(async (doctor) => {
          try {
            const feedbackRows = await listDoctorFeedback(doctor.id, 5);
            return [doctor.id, feedbackRows] as const;
          } catch {
            return [doctor.id, []] as const;
          }
        }),
      );
      setFeedbackByDoctor(Object.fromEntries(feedbackPairs));
    } else {
      setFeedbackByDoctor({});
    }

    if (!selectedDoctorId && rows.length > 0) {
      setSelectedDoctorId(rows[0].id);
    }
  }, [selectedDoctorId]);

  const loadProfileAndAppointments = useCallback(async () => {
    if (!authUserId) return;

    const me = await getPatientPortalMe(authUserId);
    setProfile(me);

    if (me) {
      setName(me.name || "");
      setPhone(me.phone || "");
      const [appts, reportRows] = await Promise.all([
        listPatientPortalAppointments(authUserId),
        listReports(me.id),
      ]);
      setAppointments(appts);
      setReports(Array.isArray(reportRows) ? reportRows : []);
    } else {
      setAppointments([]);
      setReports([]);
      setName(user?.name || "");
      setPhone("");
    }
  }, [authUserId, user?.name]);

  useEffect(() => {
    if (!isAuthenticated || !authUserId) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    Promise.all([loadDoctors(), loadProfileAndAppointments()])
      .catch((err) => {
        if (active) {
          const text = err instanceof Error ? err.message : "Failed to load patient portal.";
          setMessage(text);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authUserId, isAuthenticated, loadDoctors, loadProfileAndAppointments]);

  const handleRegister = useCallback(async () => {
    if (!authUserId || !user?.email) return;
    if (!name.trim() || !phone.trim() || !selectedDoctorId) {
      setMessage("Please fill name, phone, and primary doctor.");
      return;
    }

    setRegistering(true);
    setMessage(null);
    try {
      const created = await registerPatientPortal({
        auth_user_id: authUserId,
        email: user.email,
        name: name.trim(),
        phone: phone.trim(),
        doctor_id: selectedDoctorId,
      });
      setProfile(created);
      const [appts, reportRows] = await Promise.all([
        listPatientPortalAppointments(authUserId),
        listReports(created.id),
      ]);
      setAppointments(appts);
      setReports(Array.isArray(reportRows) ? reportRows : []);
      setMessage("Patient profile registered successfully.");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Registration failed.";
      setMessage(text);
    } finally {
      setRegistering(false);
    }
  }, [authUserId, name, phone, selectedDoctorId, user?.email]);

  const upcomingAppointments = useMemo(
    () => appointments.filter((appt) => !["cancelled", "completed", "no_show"].includes(appt.status)),
    [appointments],
  );

  const handleCancelAppointment = useCallback(
    async (appointmentId: string) => {
      if (!authUserId) return;
      setMessage(null);
      try {
        await cancelPatientPortalAppointment(appointmentId, {
          auth_user_id: authUserId,
        });
        const appts = await listPatientPortalAppointments(authUserId);
        setAppointments(appts);
        setMessage("Appointment cancelled.");
      } catch (err) {
        const text = err instanceof Error ? err.message : "Cancel failed.";
        setMessage(text);
      }
    },
    [authUserId],
  );

  if (isLoading || loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading patient portal...
        </div>
      </div>
    );
  }

  if (user?.role && user.role !== "patient") {
    const isDoctor = user.role === "doctor";
    return (
      <RoleMismatchState
        title={isDoctor ? "This portal is for patients" : "Complete onboarding first"}
        description={
          isDoctor
            ? "You are signed in as a doctor. Use the doctor dashboard for patient management, call logs, and workflow tools."
            : "You need to finish onboarding before using the patient portal."
        }
        actionLabel={isDoctor ? "Go to doctor dashboard" : "Finish onboarding"}
        actionHref={isDoctor ? "/dashboard" : "/onboarding"}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-serif text-4xl tracking-tight md:text-5xl">Patient Portal</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to view doctors, register as a patient, and book appointments.
        </p>
        <div className="flex items-center gap-2">
          <Link href="/patient-signIn">
            <Button>Patient Login</Button>
          </Link>
          <Link href="/patient-signUp">
            <Button variant="outline">Create Patient Account</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Patient Portal</p>
            <h1 className="text-sm font-semibold">Welcome, {user?.name || "Patient"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/patient/booking">
              <Button variant="outline" size="sm">Book Appointment</Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6 md:grid-cols-3">
        <section className="md:col-span-1 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Quick Actions</p>
            <h2 className="mt-2 text-base font-semibold">Plan Your Next Visit</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Book appointments with available doctors and choose from open slots.
            </p>
            <Link href="/patient/booking" className="mt-3 block">
              <Button className="w-full">Book Appointment</Button>
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Patient Registration</h2>

            {profile ? (
              <div className="space-y-2 text-sm">
                <p><span className="text-muted-foreground">Name:</span> {profile.name}</p>
                <p><span className="text-muted-foreground">Email:</span> {profile.email}</p>
                <p><span className="text-muted-foreground">Phone:</span> {profile.phone}</p>
                <p><span className="text-muted-foreground">Primary doctor:</span> {doctors.find((d) => d.id === profile.doctor_id)?.name || "Assigned"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone Number"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select primary doctor</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} - {doctor.specialty}
                    </option>
                  ))}
                </select>
                <Button disabled={registering} onClick={handleRegister}>
                  {registering ? "Registering..." : "Register Patient Profile"}
                </Button>
              </div>
            )}
          </div>
        </section>

        <section className="md:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Upcoming Appointments</h2>
            {upcomingAppointments.length === 0 ? (
              <p className="text-xs text-muted-foreground">No upcoming appointments yet.</p>
            ) : (
              <div className="space-y-2">
                {upcomingAppointments.map((appt) => (
                  <div key={appt.id} className="rounded-lg border border-border/70 bg-background p-2 text-xs">
                    <p className="font-medium">{appt.doctor_name || "Doctor"}</p>
                    <p className="text-muted-foreground">{appt.doctor_specialty || ""}</p>
                    <p>{formatDateTime(appt.slot_start)}</p>
                    <p className="text-muted-foreground capitalize">Status: {appt.status}</p>
                    {appt.status !== "cancelled" && appt.status !== "completed" && appt.status !== "no_show" && (
                      <div className="mt-2 flex gap-2">
                        <Link href={`/consultation/${appt.id}`}>
                          <Button size="sm" variant="outline">Open Chat</Button>
                        </Link>
                        <Link href={`/patient/booking?appointmentId=${appt.id}`}>
                          <Button size="sm" variant="outline">Reschedule</Button>
                        </Link>
                        <Button size="sm" variant="outline" onClick={() => handleCancelAppointment(appt.id)}>
                          Cancel
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">My Reports</h2>
            {reports.length === 0 ? (
              <p className="text-xs text-muted-foreground">No reports available yet.</p>
            ) : (
              <div className="space-y-2">
                {reports.slice(0, 12).map((report) => {
                  const reportTitle =
                    (report.report_data?.title as string | undefined)
                    || (report.report_data?.summary as string | undefined)
                    || "Clinical Report";

                  return (
                    <div key={report.id} className="rounded-lg border border-border/70 bg-background p-3 text-xs">
                      <p className="inline-flex items-center gap-1 font-medium">
                        <FileText className="size-3.5" />
                        {reportTitle}
                      </p>
                      <p className="mt-1 text-muted-foreground">Generated on {formatDateTime(report.created_at)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Doctors and Feedback</h2>
            {doctors.length === 0 ? (
              <p className="text-xs text-muted-foreground">No doctors available right now.</p>
            ) : (
              <div className="space-y-3">
                {doctors.map((doctor) => {
                  const feedbackRows = feedbackByDoctor[doctor.id] || [];
                  return (
                    <div key={doctor.id} className="rounded-lg border border-border/70 bg-background p-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-medium">{doctor.name}</p>
                          <p className="text-xs text-muted-foreground">{doctor.specialty} • {doctor.language}</p>
                          <p className="text-xs text-muted-foreground">
                            Rating: {doctor.rating_avg?.toFixed(1) || "0.0"} ({doctor.rating_count || 0})
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/patient/booking?doctorId=${doctor.id}`}>
                            <Button size="sm" variant="outline">Begin See Available Slots</Button>
                          </Link>
                          <Button size="sm" onClick={() => setFeedbackDoctorId(doctor.id)}>Add Feedback</Button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {feedbackRows.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No feedback yet for this doctor.</p>
                        ) : (
                          feedbackRows.map((item) => (
                            <div key={item.id} className="rounded-md border border-border/70 px-3 py-2 text-xs">
                              <p className="font-medium">{item.rating}/5</p>
                              <p className="text-muted-foreground">{item.comment || "No comment"}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(item.created_at)}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {message && (
            <div className="mt-4 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {message}
            </div>
          )}

          {feedbackDoctorId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Add Feedback</h3>
                  <Button size="sm" variant="ghost" onClick={() => setFeedbackDoctorId(null)}>Close</Button>
                </div>
                <FeedbackForm
                  doctorId={feedbackDoctorId}
                  patientId={profile?.id}
                  onSubmitted={async () => {
                    const rows = await listDoctorFeedback(feedbackDoctorId, 5).catch(() => []);
                    setFeedbackByDoctor((prev) => ({ ...prev, [feedbackDoctorId]: rows }));
                    await loadDoctors().catch(() => undefined);
                    setFeedbackDoctorId(null);
                  }}
                />
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-medium">{value}</p>
    </div>
  );
}
