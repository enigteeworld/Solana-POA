"use client";

import { ThemeToggle } from "./theme-toggle";
import { WalletButton } from "./wallet-button";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40">
      <div className="backdrop-blur-xl bg-white/55 dark:bg-black/25 border-b border-white/30 dark:border-white/10 transition">
        <div className="container-page py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <span className="text-xl">🚀</span>
            <span className="tracking-tight">Open Rails</span>
            <span className="ml-2 inline-flex items-center gap-2 pill">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
              Live
            </span>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}