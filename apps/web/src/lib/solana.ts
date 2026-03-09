import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { AnchorWallet } from "@solana/wallet-adapter-react";

import idlJson from "@/lib/idl/open_rails.json";

export const OPEN_RAILS_PROGRAM_ID = new PublicKey(
  "BwxnJR3UjoLYM3oPEHA5742zWLu2HSrGFDAKqDEQumvv"
);

function toAnchorWallet(wallet: WalletContextState): AnchorWallet {
  // Anchor only needs these 3 properties.
  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    throw new Error("Wallet not connected");
  }

  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
  };
}

export function getProvider(connection: Connection, wallet: WalletContextState) {
  const anchorWallet = toAnchorWallet(wallet);
  return new AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
}

export function getProgram(
  connection: Connection,
  wallet: WalletContextState
): Program<Idl> {
  const provider = getProvider(connection, wallet);

  const idl = idlJson as Idl;

  return new Program(idl, provider);
}