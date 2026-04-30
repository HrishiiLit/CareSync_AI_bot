"use client";

import { useLocalAuth } from "@/lib/local-auth";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { RoleMismatchState } from "@/components/RoleMismatchState";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, isAuthenticated, user } = useLocalAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Optional: redirect to login if not authenticated
      // router.push("/signIn");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-sm text-muted-foreground font-medium animate-pulse">Loading CareSync…</div>
      </div>
    );
  }

  if (user?.role && user.role !== "doctor") {
    const isPatient = user.role === "patient";
    return (
      <RoleMismatchState
        title={isPatient ? "This portal is for doctors" : "Complete onboarding first"}
        description={
          isPatient
            ? "You are signed in as a patient. Use the patient portal to view appointments, reports, and booking tools."
            : "You need to finish onboarding before accessing the doctor dashboard."
        }
        actionLabel={isPatient ? "Go to patient portal" : "Finish onboarding"}
        actionHref={isPatient ? "/patient" : "/onboarding"}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col lg:pl-64">
        <Topbar />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
