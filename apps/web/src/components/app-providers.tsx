"use client";

import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

import "@solana/wallet-adapter-react-ui/styles.css";
import { ToastProvider } from "@/components/ui/toast";
import { ToastHost } from "@/components/ui/toast-host";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => "https://api.devnet.solana.com", []);

  const wallets = useMemo(() => {
    const list = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: WalletAdapterNetwork.Devnet }),
    ];

    // Dedupe by wallet name to avoid React key collisions (e.g., MetaMask appearing twice)
    const seen = new Set<string>();
    return list.filter((w) => {
      if (seen.has(w.name)) return false;
      seen.add(w.name);
      return true;
    });
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ToastProvider>
            {children}
            <ToastHost />
          </ToastProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}