"use client";

import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function WalletButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Prevent SSR/client mismatch by not rendering the wallet UI until mounted.
  if (!mounted) {
    return (
      <button className="rounded-full px-4 py-2 bg-white/70 dark:bg-white/10 backdrop-blur-md border border-white/40 dark:border-white/20 text-slate-900 dark:text-white shadow hover:scale-105 transition">
        Select Wallet
      </button>
    );
  }

  return (
    <WalletMultiButton className="!rounded-full !px-4 !py-2 !bg-gradient-to-r !from-indigo-500 !via-purple-500 !to-pink-500 hover:!scale-105 transition !text-white !shadow-lg" />
  );
}