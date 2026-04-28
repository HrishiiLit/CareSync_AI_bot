"use client";

import { useState, useEffect } from "react";
import { useLocalAuth } from "@/lib/local-auth";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, User, Phone, Stethoscope, CheckCircle2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function OnboardingPage() {
  const { user, token, isAuthenticated, isLoading } = useLocalAuth();
  const router = useRouter();
  
  const [role, setRole] = useState<"doctor" | "patient" | "pending" | null>(null);
  const [selectedRole, setSelectedRole] = useState<"doctor" | "patient" | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
    if (user?.role) {
      setRole(user.role);
      if (user.role !== "pending") {
        setSelectedRole(user.role as "doctor" | "patient");
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      setError("Please select a role.");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        auth_user_id: user?.sub,
        role: selectedRole,
        email: user?.email,
        name,
        phone,
        specialty: selectedRole === "doctor" ? specialty : undefined
      };

      const res = await fetch(`${API_URL}/api/auth/onboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save profile");
      }
      
      // Update local storage role/session? 
      // A full page reload might be easiest to resync session, or redirect to home and let the provider re-sync
      window.location.href = selectedRole === "doctor" ? "/dashboard" : "/patient";
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !role) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="size-6 text-primary" />
          </div>
          <h1 className="text-3xl font-serif tracking-tight">Complete Your Profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Just a few more details to get you started.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-xl shadow-primary/5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {role === "pending" && (
              <div className="space-y-3 pb-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">I am a:</label>
                <div className="flex gap-4">
                  <Button 
                    type="button" 
                    variant={selectedRole === "doctor" ? "default" : "outline"} 
                    className="flex-1"
                    onClick={() => setSelectedRole("doctor")}
                  >
                    Doctor
                  </Button>
                  <Button 
                    type="button" 
                    variant={selectedRole === "patient" ? "default" : "outline"} 
                    className="flex-1"
                    onClick={() => setSelectedRole("patient")}
                  >
                    Patient
                  </Button>
                </div>
              </div>
            )}

            {selectedRole && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={selectedRole === "doctor" ? "Dr. Jane Smith" : "John Doe"}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <input
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                </div>

                {selectedRole === "doctor" && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Specialty</label>
                    <div className="relative">
                      <Stethoscope className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                      <input
                        required
                        value={specialty}
                        onChange={(e) => setSpecialty(e.target.value)}
                        placeholder="Cardiology / General Practice"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                    </div>
                  </div>
                )}

                {error && <p className="text-xs text-destructive text-center">{error}</p>}

                <Button type="submit" disabled={submitting} className="w-full shadow-lg shadow-primary/20 mt-4">
                  {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {submitting ? "Finalizing..." : "Complete Setup"}
                </Button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
