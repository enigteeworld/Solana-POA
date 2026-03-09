"use client";

import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="inline-flex h-11 min-w-[110px] max-w-[140px] items-center justify-center overflow-hidden whitespace-nowrap rounded-2xl border border-white/40 bg-white/70 px-3 text-sm font-semibold text-slate-900 shadow backdrop-blur-md transition dark:border-white/20 dark:bg-white/10 dark:text-white"
      >
        <span className="sm:hidden">Wallet</span>
        <span className="hidden sm:inline">Select Wallet</span>
      </button>
    );
  }

  return (
    <div className="wallet-btn-shell shrink-0">
      <WalletMultiButton className="!m-0 !inline-flex !h-11 !min-w-[110px] !max-w-[140px] !items-center !justify-center !overflow-hidden !whitespace-nowrap !rounded-2xl !border-0 !bg-gradient-to-r !from-indigo-500 !via-purple-500 !to-pink-500 !px-3 !text-sm !font-semibold !text-white !shadow-lg transition hover:!scale-[1.02] sm:!max-w-[180px] sm:!px-4" />
    </div>
  );
}