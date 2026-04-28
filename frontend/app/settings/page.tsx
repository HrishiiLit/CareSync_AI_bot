"use client";

import { useLocalAuth } from "@/lib/local-auth";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { user, logout } = useLocalAuth();
  const router = useRouter();

  const onSignOut = () => {
    logout();
    router.push("/signIn");
  };

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage profile and session preferences.</p>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <h2 className="font-medium">Account</h2>
        <p className="mt-2 text-sm">Name: {user?.name ?? "Not set"}</p>
        <p className="text-sm">Email: {user?.email ?? "Not set"}</p>
        <p className="text-sm">Role: {user?.role ?? "doctor"}</p>
        <p className="text-sm">User ID: {user?.sub ?? "Not set"}</p>
      </div>

      <button
        type="button"
        onClick={onSignOut}
        className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
      >
        Sign Out
      </button>
    </section>
  );
}
