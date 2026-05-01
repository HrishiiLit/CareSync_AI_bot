"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowUpRight, User as UserIcon } from "lucide-react";
import { useLocalAuth } from "@/lib/local-auth";

const navLinks = [
  { href: "/doctors", label: "Doctors" },
  { href: "/about", label: "About" },
  { href: "/features", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { isAuthenticated, user, isLoading } = useLocalAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY >= 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const collapsed = scrolled;

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-500 ${collapsed
          ? "bg-background/80 backdrop-blur-xl"
          : "bg-background/80 backdrop-blur-xl"
        }`}
    >
      {/* Single morphing nav */}
      <nav
        className={`mx-auto flex items-center justify-between border border-transparent transition-all duration-500 h-20 px-6 ${collapsed
            ? "max-w-full h-16 px-4 border-border/50 bg-background/90 shadow-lg backdrop-blur-xl mt-2"
            : "max-w-7xl bg-transparent shadow-none backdrop-blur-none mt-0"
          }`}
      >
        {/* Logo — always visible, shrinks when collapsed */}
        <Link
          href="/"
          className={`flex items-center gap-2 font-serif tracking-tight text-foreground transition-all duration-500 text-2xl flex-shrink-0 ${collapsed ? "text-lg" : ""}`}
        >
          <Image
            src="/assets/Clarus.png"
            alt="Clarus"
            width={36}
            height={36}
            className={`transition-all duration-500 h-9 w-9 flex-shrink-0 ${collapsed ? "h-6 w-6" : ""}`}
          />
          <span className="whitespace-nowrap">CareSync AI</span>
        </Link>

        {/* Desktop nav links */}
        <div
          className={`hidden items-center md:flex transition-all duration-500 flex-shrink-0 ${collapsed ? "gap-2" : "gap-8"
            }`}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-all duration-500 whitespace-nowrap ${collapsed
                  ? pathname === link.href
                    ? "rounded-full bg-foreground px-3 py-1 text-background text-xs"
                    : "rounded-full px-3 py-1 text-muted-foreground hover:bg-muted hover:text-foreground text-xs"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {link.label}
            </Link>
          ))}

          {!isLoading && isAuthenticated ? (
            <Link
              href={user?.role === "patient" ? "/patient" : "/dashboard"}
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 flex-shrink-0 whitespace-nowrap"
            >
              <UserIcon className="h-3.5 w-3.5" />
              Dashboard
            </Link>
          ) : (
            <Link
              href="/signIn"
              className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80 flex-shrink-0 whitespace-nowrap"
            >
              Login / Sign Up
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="inline-flex items-center justify-center rounded-lg p-2 text-foreground md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border bg-background px-6 pb-6 pt-4 md:hidden">
          <div className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 border-t border-border pt-4">
              {!isLoading && isAuthenticated ? (
                <Link
                  href={user?.role === "patient" ? "/patient" : "/dashboard"}
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
                  onClick={() => setMobileOpen(false)}
                >
                  <UserIcon className="h-4 w-4" />
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/signIn"
                  className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
                  onClick={() => setMobileOpen(false)}
                >
                  Login / Sign Up
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}