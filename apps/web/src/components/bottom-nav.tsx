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
        "flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition",
        active
          ? "bg-white/60 text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.12)] dark:bg-white/12 dark:text-white"
          : "text-slate-800/80 hover:opacity-100 dark:text-white/80",
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
      className="fixed inset-x-0 bottom-0 z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="container-page pb-2">
        <div className="nav-blur rounded-t-3xl border border-white/20 border-b-0 dark:border-white/10">
          <div className="grid min-h-[72px] grid-cols-5 items-center gap-1 px-2 py-2">
            <Tab href="/" icon="🏠" label="Home" />
            <Tab href="/organizer" icon="🎛️" label="Host" />
            <Tab href="/participant" icon="🎟️" label="Claim" />
            <Tab href="/validator" icon="✅" label="Verify" />
            <Tab href="/explore" icon="🔎" label="Explore" />
          </div>
        </div>
      </div>
    </div>
  );
}