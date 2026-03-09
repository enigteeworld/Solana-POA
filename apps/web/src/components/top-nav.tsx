"use client";

import { ThemeToggle } from "./theme-toggle";
import { WalletButton } from "./wallet-button";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40">
      <div className="border-b border-white/30 bg-white/55 backdrop-blur-xl transition dark:border-white/10 dark:bg-black/25">
        <div className="container-page py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2 font-semibold">
              <span className="shrink-0 text-xl">🚀</span>

              <div className="min-w-0">
                <div className="truncate tracking-tight">Open Rails</div>
              </div>

              <span className="ml-1 hidden items-center gap-2 pill sm:inline-flex">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
                Live
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <span className="inline-flex items-center gap-2 pill sm:hidden">
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
                Live
              </span>
              <ThemeToggle />
              <WalletButton />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}