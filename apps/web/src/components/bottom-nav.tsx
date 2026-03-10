"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Tab({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={[
        "group flex min-h-[66px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-all duration-200",
        active
          ? [
              "bg-white/60 text-slate-950",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_24px_rgba(15,23,42,0.12)]",
              "dark:bg-white/12 dark:text-white",
              "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_24px_rgba(0,0,0,0.28)]",
            ].join(" ")
          : [
              "text-slate-800 hover:bg-white/35 hover:text-slate-950",
              "dark:text-white/95 dark:hover:bg-white/8 dark:hover:text-white",
            ].join(" "),
      ].join(" ")}
    >
      <div
        className={[
          "text-[22px] leading-none transition-all duration-200",
          active ? "scale-105 opacity-100" : "opacity-95 group-hover:scale-105",
        ].join(" ")}
      >
        {icon}
      </div>

      <div
        className={[
          "text-[11px] font-bold leading-none tracking-[0.01em]",
          active ? "opacity-100" : "opacity-95",
        ].join(" ")}
      >
        {label}
      </div>
    </Link>
  );
}

export function BottomNav() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50"
      style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
    >
      <div className="container-page pointer-events-none">
        <div className="pointer-events-auto mx-auto max-w-[980px] px-2">
          <div className="relative overflow-hidden rounded-[28px] border border-white/25 bg-white/28 shadow-[0_18px_60px_rgba(15,23,42,0.18)] backdrop-blur-2xl dark:border-white/12 dark:bg-white/8 dark:shadow-[0_18px_60px_rgba(0,0,0,0.42)]">
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.30),rgba(255,255,255,0.08))] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))]" />
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/45 dark:bg-white/14" />

            <div className="relative grid grid-cols-5 gap-1 p-2">
              <Tab href="/" icon="🏠" label="Home" />
              <Tab href="/organizer" icon="🎛️" label="Host" />
              <Tab href="/participant" icon="🎟️" label="Claim" />
              <Tab href="/validator" icon="✅" label="Verify" />
              <Tab href="/explore" icon="🔎" label="Explore" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}