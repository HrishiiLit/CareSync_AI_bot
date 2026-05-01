"use client";

import Link from "next/link";
import { useLocalAuth } from "@/lib/local-auth";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Mail, Lock, User, Phone, Loader2, ArrowLeft } from "lucide-react";

export default function SignUpPage() {
  const { registerWithPassword, loginWithGoogle, isLoading } = useLocalAuth();
  const router = useRouter();
  
  const [role, setRole] = useState<"patient" | "doctor">("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [mobile, setMobile] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const session = await registerWithPassword({ role, email, password, username, mobile });
      
      const newRole = session?.user?.role;
      if (newRole === "patient") {
        router.push("/patient");
      } else if (newRole === "doctor") {
        router.push("/dashboard");
      } else {
        router.push("/onboarding");
      }
    } catch (err: any) {
      const text = err instanceof Error ? err.message : "Registration failed";
      setError(text.replace(/^\{"detail":"|"\}$/g, ""));
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create an Account</h1>
        <p className="text-sm text-muted-foreground">Join CareSync AI today.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input 
                type="radio" 
                name="role" 
                value="patient" 
                checked={role === "patient"} 
                onChange={() => setRole("patient")} 
                className="accent-primary"
              />
              Patient
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input 
                type="radio" 
                name="role" 
                value="doctor" 
                checked={role === "doctor"} 
                onChange={() => setRole("doctor")} 
                className="accent-primary"
              />
              Doctor
            </label>
          </div>

          <div className="relative">
            <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Full Name"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="relative">
            <Phone className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              placeholder="Phone Number"
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)"
              required
              minLength={6}
              className="flex h-10 w-full rounded-md border border-input bg-background px-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3">
            <p className="text-xs font-medium text-destructive">{error}</p>
          </div>
        )}

        <Button type="submit" disabled={submitting} className="w-full shadow-lg shadow-primary/20">
          {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          {submitting ? "Creating account..." : "Sign Up"}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => loginWithGoogle()}
        >
          <svg className="mr-2 size-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
          Google
        </Button>
      </form>

      <div className="flex flex-col space-y-4 text-center">
        <Link href="/signIn" className="inline-flex items-center justify-center text-xs text-muted-foreground hover:text-primary">
          <ArrowLeft className="mr-1 size-3" />
          Already have an account? Log in
        </Link>
      </div>
    </div>
  );
}
