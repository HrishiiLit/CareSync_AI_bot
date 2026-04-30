"use client";

import { useLocalAuth } from "@/lib/local-auth";
import { RoleMismatchState } from "@/components/RoleMismatchState";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useLocalAuth();

  if (user?.role === "doctor" || user?.role === "pending") {
    const isDoctor = user?.role === "doctor";
    return (
      <RoleMismatchState
        title={isDoctor ? "This portal is for patients" : "Complete onboarding first"}
        description={
          isDoctor
            ? "You are signed in as a doctor. Use the doctor dashboard for patient management, call logs, and workflow tools."
            : "You need to finish onboarding before accessing the patient portal."
        }
        actionLabel={isDoctor ? "Go to doctor dashboard" : "Finish onboarding"}
        actionHref={isDoctor ? "/dashboard" : "/onboarding"}
      />
    );
  }

  return <>{children}</>;
}
