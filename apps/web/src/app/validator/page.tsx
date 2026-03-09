"use client";

import React, { useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  Keypair,
  PublicKey,
  SendTransactionError,
  SystemProgram,
} from "@solana/web3.js";

import { getProgram } from "@/lib/solana";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/explorer";
import { useToast } from "@/components/ui/toast";

function shortPk(pk: string) {
  return `${pk.slice(0, 6)}…${pk.slice(-6)}`;
}

export default function ValidatorPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { push } = useToast();

  const [claimAddress, setClaimAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastProof, setLastProof] = useState<string>("");

  const canApprove = useMemo(() => {
    return !!wallet.publicKey && claimAddress.trim().length >= 32 && !busy;
  }, [wallet.publicKey, claimAddress, busy]);

  async function onApproveClaim() {
    if (!wallet.publicKey) {
      push({
        type: "error",
        title: "Connect wallet",
        description: "Connect the organizer wallet to approve this claim.",
      });
      return;
    }

    if (!claimAddress.trim()) {
      push({
        type: "error",
        title: "Missing claim PDA",
        description: "Paste a claim PDA first.",
      });
      return;
    }

    setBusy(true);

    try {
      const claimPk = new PublicKey(claimAddress.trim());
      const claimAccount = await connection.getAccountInfo(claimPk);

      if (!claimAccount) {
        push({
          type: "error",
          title: "Claim not found",
          description: "No account exists at that claim PDA.",
        });
        return;
      }

      const program = getProgram(connection, wallet);

      const proofSeed = Keypair.generate().publicKey;

      const sig = await program.methods
        .approveClaim()
        .accountsPartial({
          authority: wallet.publicKey,
          claim: claimPk,
          proof: proofSeed,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setLastProof(proofSeed.toBase58());

      push({
        type: "success",
        title: "Proof issued ✅",
        description: `Proof: ${shortPk(proofSeed.toBase58())}`,
        actionLabel: "View tx",
        onAction: () => window.open(explorerTxUrl(sig), "_blank"),
      });

      console.log("approveClaim tx:", sig);
      console.log("claim:", claimPk.toBase58());
      console.log("proof:", proofSeed.toBase58());
    } catch (e: unknown) {
      if (e instanceof SendTransactionError) {
        let logs: string[] | undefined;
        try {
          logs = await e.getLogs(connection);
        } catch {
          // ignore
        }

        push({
          type: "error",
          title: "Approve failed",
          description: e.message || "SendTransactionError",
          actionLabel: logs?.length ? "Show logs" : undefined,
          onAction: logs?.length
            ? () => console.log("Approve logs:", logs)
            : undefined,
        });
        console.error(e, logs);
        return;
      }

      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Approval failed";

      push({
        type: "error",
        title: "Approve failed",
        description: msg,
      });
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 sm:p-8">
        <div className="badge">Validator</div>
        <h1 className="h1 mt-3">Approve claims and issue proofs</h1>
        <p className="p mt-2">
          In MVP, the organizer authority approves claims and writes a canonical
          Proof record on-chain.
        </p>
      </div>

      <div className="card-solid p-6">
        <h2 className="h2">Approve a Claim</h2>
        <p className="p mt-2">Paste the claim account address to approve it.</p>

        <div className="mt-4">
          <label className="label">Claim account pubkey</label>
          <input
            className="input mt-2"
            placeholder="Claim PDA address"
            value={claimAddress}
            onChange={(e) => setClaimAddress(e.target.value)}
          />

          <button
            className="btn-primary mt-4 w-full"
            onClick={onApproveClaim}
            disabled={!canApprove}
            type="button"
          >
            {busy ? "Approving…" : "Approve Claim → Issue Proof"}
          </button>

          {!wallet.publicKey ? (
            <div className="mt-3 text-xs opacity-70">
              Connect the organizer wallet first.
            </div>
          ) : null}
        </div>
      </div>

      {lastProof ? (
        <div className="card-solid p-6">
          <div className="text-sm font-semibold">Last issued proof</div>
          <div className="mt-2 font-mono text-xs break-all opacity-80">
            {lastProof}
          </div>

          <div className="mt-4">
            <button
              className="btn-secondary"
              onClick={() =>
                window.open(explorerAddressUrl(lastProof), "_blank")
              }
              type="button"
            >
              View proof
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}