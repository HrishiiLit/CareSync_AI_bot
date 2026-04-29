"use client";

import { FormEvent, useEffect, useState } from "react";
import { useLocalAuth } from "@/lib/local-auth";
import { createDoctorSlot, deleteDoctorSlot, listDoctorSlots, type DoctorManagedSlot } from "@/services/api";

export default function AvailabilityPage() {
  const { user } = useLocalAuth();
  const doctorId = user?.doctor_id ?? user?.sub;

  const [slots, setSlots] = useState<DoctorManagedSlot[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!doctorId) {
      setSlots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listDoctorSlots(doctorId);
      setSlots(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setSlots([]);
      setError(err instanceof Error ? err.message : "Failed to load slots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [doctorId]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!doctorId || !start || !end) return;
    setSaving(true);
    setError(null);
    try {
      await createDoctorSlot(doctorId, {
        slot_start: new Date(start).toISOString(),
        slot_end: new Date(end).toISOString(),
        status: "available",
      });
      setStart("");
      setEnd("");
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create slot.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (slotId: string) => {
    if (!doctorId) return;
    try {
      await deleteDoctorSlot(doctorId, slotId);
      await refresh();
    } catch {
      setError("Failed to delete slot.");
    }
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Manage Availability</h1>
        <p className="text-sm text-muted-foreground">Create and remove doctor slots used by booking flows.</p>
      </div>

      <form onSubmit={onCreate} className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <label className="text-sm md:col-span-1">
          Start
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
            required
          />
        </label>
        <label className="text-sm md:col-span-1">
          End
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
            required
          />
        </label>
        <div className="md:col-span-2 md:self-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Slot"}
          </button>
        </div>
      </form>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading slots...</p> : null}

      <div className="space-y-2">
        {slots.map((slot) => (
          <div key={slot.id} className="flex flex-col justify-between gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-medium">{new Date(slot.slot_start).toLocaleString()} - {new Date(slot.slot_end).toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Status: {slot.status}</p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(slot.id)}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
            >
              Delete
            </button>
          </div>
        ))}
        {!loading && slots.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">No slots found.</div>
        ) : null}
      </div>
    </section>
  );
}
