"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLocalAuth } from "@/lib/local-auth";
import { listDoctors, listDoctorAvailability, listDoctorFeedback, type DoctorAvailabilitySlot, type DoctorFeedbackItem, type DoctorListItem } from "@/services/api";
import { Button } from "@/components/ui/button";
import { CalendarClock, CircleDollarSign, Loader2, Languages, Star, Stethoscope } from "lucide-react";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function toAvailabilityLabel(slot: DoctorAvailabilitySlot) {
  return `${formatDateTime(slot.slot_start)} - ${formatDateTime(slot.slot_end)}`;
}

export default function DoctorDetailPage() {
  const params = useParams<{ doctorId: string }>();
  const doctorId = params?.doctorId;
  const { isAuthenticated, isLoading, user } = useLocalAuth();

  const [doctor, setDoctor] = useState<DoctorListItem | null>(null);
  const [availability, setAvailability] = useState<DoctorAvailabilitySlot[]>([]);
  const [feedback, setFeedback] = useState<DoctorFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doctorId) return;

    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      listDoctors(),
      listDoctorAvailability(doctorId),
      listDoctorFeedback(doctorId, 8),
    ])
      .then(([doctors, slots, feedbackRows]) => {
        if (!active) return;
        setDoctor(doctors.find((item) => item.id === doctorId) ?? null);
        setAvailability(Array.isArray(slots) ? slots : []);
        setFeedback(Array.isArray(feedbackRows) ? feedbackRows : []);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load doctor details.");
        setDoctor(null);
        setAvailability([]);
        setFeedback([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [doctorId]);

  const nextSlot = useMemo(() => availability[0] ?? null, [availability]);

  if (isLoading || loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading doctor profile...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Doctor profile</p>
        <h1 className="font-serif text-4xl tracking-tight md:text-5xl">View doctor details</h1>
        <p className="text-sm text-muted-foreground">Sign in as a patient to see details, feedback, and availability.</p>
        <Link href="/patient-signIn"><Button>Patient Login</Button></Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Doctor not found.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Patient view</p>
          <h1 className="mt-2 font-serif text-4xl tracking-tight">{doctor.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Doctor details, availability, and recent patient feedback.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/patient/booking">
            <Button variant="outline">Book Appointment</Button>
          </Link>
          <Link href="/doctors">
            <Button variant="outline">Back to Doctors</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-border bg-card p-5 md:col-span-2">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Stethoscope className="size-4" />{doctor.specialty}</span>
            <span className="inline-flex items-center gap-1"><Languages className="size-4" />{doctor.language}</span>
            <span className="inline-flex items-center gap-1"><CircleDollarSign className="size-4" />${doctor.fee}</span>
            <span className="inline-flex items-center gap-1"><Star className="size-4 text-yellow-500" />{doctor.rating_avg?.toFixed(1) || "0.0"} ({doctor.rating_count || 0})</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Consultation type: <span className="font-medium text-foreground">{doctor.consultation_type}</span>
          </p>

          <div className="mt-5 rounded-xl border border-border/70 bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Availability</h2>
                <p className="text-xs text-muted-foreground">{availability.length > 0 ? `${availability.length} upcoming slot${availability.length === 1 ? "" : "s"}` : "No upcoming slots currently."}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-medium ${doctor.available_now ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                {doctor.available_now ? "Available now" : nextSlot ? `Next: ${formatDateTime(nextSlot.slot_start)}` : "Unavailable"}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {availability.length === 0 ? (
                <p className="text-sm text-muted-foreground">This doctor has no published slots yet.</p>
              ) : (
                availability.slice(0, 6).map((slot) => (
                  <div key={slot.id} className="flex flex-col gap-2 rounded-lg border border-border/70 px-3 py-2 md:flex-row md:items-center md:justify-between">
                    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarClock className="size-4" />
                      {toAvailabilityLabel(slot)}
                    </span>
                    <Link href={`/patient/booking?doctorId=${doctor.id}`}>
                      <Button size="sm" variant="outline">Reserve in Booking Flow</Button>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Summary</h2>
            <div className="mt-3 grid gap-3 text-sm">
              <KeyValue label="Specialty" value={doctor.specialty} />
              <KeyValue label="Language" value={doctor.language} />
              <KeyValue label="Consultation type" value={doctor.consultation_type} />
              <KeyValue label="Fee" value={`$${doctor.fee}`} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Recent Feedback</h2>
            <div className="mt-3 space-y-2">
              {feedback.length === 0 ? (
                <p className="text-sm text-muted-foreground">No feedback yet for this doctor.</p>
              ) : (
                feedback.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border/70 bg-background p-3 text-xs">
                    <p className="font-medium">{item.rating}/5</p>
                    <p className="mt-1 text-muted-foreground">{item.comment || "No comment"}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(item.created_at)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium">{value}</p>
    </div>
  );
}