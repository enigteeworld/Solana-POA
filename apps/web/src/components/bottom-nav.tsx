"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Tab({ href, icon, label }: { href: string; icon: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl transition
        ${active ? "bg-white/60 dark:bg-white/10" : "opacity-80 hover:opacity-100"}`}
    >
      <div className="text-xl">{icon}</div>
      <div className="text-[11px] font-semibold">{label}</div>
    </Link>
  );
}

export function BottomNav() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="nav-blur">
        <div className="container-page h-16 flex items-center justify-between">
          <Tab href="/" icon="🏠" label="Home" />
          <Tab href="/organizer" icon="🎛️" label="Host" />
          <Tab href="/participant" icon="🎟️" label="Claim" />
          <Tab href="/validator" icon="✅" label="Verify" />
          <Tab href="/explore" icon="🔎" label="Explore" />
        </div>
      </div>
    </div>
  );
}