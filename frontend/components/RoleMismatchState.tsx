"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type RoleMismatchStateProps = {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

export function RoleMismatchState({ title, description, actionLabel, actionHref }: RoleMismatchStateProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg shadow-primary/5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Wrong dashboard for this role
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-6">
          <Link href={actionHref}>
            <Button className="w-full">{actionLabel}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}