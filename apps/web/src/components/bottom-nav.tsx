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
        "flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition",
        active
          ? "bg-white/70 text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.16),0_10px_24px_rgba(0,0,0,0.16)] dark:bg-white/14 dark:text-white"
          : "text-slate-800/80 hover:bg-white/30 hover:text-slate-950 dark:text-white/80 dark:hover:bg-white/8 dark:hover:text-white",
      ].join(" ")}
    >
      <div className="text-xl leading-none">{icon}</div>
      <div className="text-[11px] font-semibold leading-none">{label}</div>
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
          <div className="rounded-[28px] border border-white/15 bg-white/70 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/72 dark:shadow-[0_18px_60px_rgba(0,0,0,0.48)]">
            <div className="grid grid-cols-5 gap-1 p-2">
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