"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SendTransactionError,
  SystemProgram,
} from "@solana/web3.js";

import { getProgram } from "@/lib/solana";
import { organizerPda } from "@/lib/pdas";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/explorer";
import { useToast } from "@/components/ui/toast";

const EMPTY_PK = "11111111111111111111111111111111";

function shortPk(pk: string) {
  return `${pk.slice(0, 6)}…${pk.slice(-6)}`;
}

type PendingClaimRow = {
  claimPda: string;
  claimant: string;
  organizer: string;
  occurredTs: number;
  submittedAt: number;
  event?: string;
  eventTitle?: string;
  actionType?: string;
  statusLabel: string;
};

function formatDateTime(unixSeconds?: number) {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return "—";
  return new Date(unixSeconds * 1000).toLocaleString();
}

function getStatusLabel(status: unknown) {
  if (!status || typeof status !== "object") return "Unknown";

  if ("pending" in (status as Record<string, unknown>)) return "Pending";
  if ("approved" in (status as Record<string, unknown>)) return "Approved";
  if ("rejected" in (status as Record<string, unknown>)) return "Rejected";

  return "Unknown";
}

function isPendingStatus(status: unknown) {
  return getStatusLabel(status) === "Pending";
}

export default function ValidatorPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { push } = useToast();

  const [busyRefresh, setBusyRefresh] = useState(false);
  const [busyApprove, setBusyApprove] = useState<string | null>(null);
  const [lastProof, setLastProof] = useState("");
  const [pendingClaims, setPendingClaims] = useState<PendingClaimRow[]>([]);

  const connected = !!wallet.publicKey;

  const loadPendingClaims = useCallback(async () => {
    if (!wallet.publicKey) {
      setPendingClaims([]);
      return;
    }

    setBusyRefresh(true);

    try {
      const program = getProgram(connection, wallet);
      const [organizer] = await organizerPda(wallet.publicKey);

      const organizerInfo = await connection.getAccountInfo(organizer);
      if (!organizerInfo) {
        setPendingClaims([]);
        push({
          type: "info",
          title: "Organizer not found",
          description:
            "This wallet does not have an organizer profile yet, so there are no claims to approve.",
        });
        return;
      }

      const allClaims: any[] = await (program.account as any).claim.all();

      const baseRows: PendingClaimRow[] = allClaims
        .map((item: any) => {
          const account = item.account;
          const claimPda = item.publicKey.toBase58();

          return {
            claimPda,
            claimant: account.claimant?.toBase58?.() ?? "",
            organizer: account.organizer?.toBase58?.() ?? "",
            occurredTs:
              typeof account.occurredTs?.toNumber === "function"
                ? account.occurredTs.toNumber()
                : Number(account.occurredTs ?? 0),
            submittedAt:
              typeof account.submittedAt?.toNumber === "function"
                ? account.submittedAt.toNumber()
                : Number(account.submittedAt ?? 0),
            event:
              account.event?.toBase58?.() &&
              account.event.toBase58() !== EMPTY_PK
                ? account.event.toBase58()
                : undefined,
            actionType:
              account.actionType?.toBase58?.() &&
              account.actionType.toBase58() !== EMPTY_PK
                ? account.actionType.toBase58()
                : undefined,
            statusLabel: getStatusLabel(account.status),
          };
        })
        .filter(
          (row: PendingClaimRow) =>
            row.organizer === organizer.toBase58() &&
            row.statusLabel === "Pending"
        )
        .sort(
          (a: PendingClaimRow, b: PendingClaimRow) =>
            b.submittedAt - a.submittedAt
        );

      const rowsWithTitles: PendingClaimRow[] = await Promise.all(
        baseRows.map(async (row) => {
          if (!row.event) return row;

          try {
            const eventPk = new PublicKey(row.event);
            const eventAccount = await (program.account as any).event.fetch(eventPk);

            return {
              ...row,
              eventTitle:
                typeof eventAccount?.name === "string" && eventAccount.name.trim()
                  ? eventAccount.name
                  : undefined,
            };
          } catch {
            return row;
          }
        })
      );

      setPendingClaims(rowsWithTitles);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Failed to load claims";

      push({
        type: "error",
        title: "Could not load pending claims",
        description: msg,
      });
      console.error(e);
    } finally {
      setBusyRefresh(false);
    }
  }, [connection, wallet, push]);

  useEffect(() => {
    void loadPendingClaims();
  }, [loadPendingClaims]);

  async function onApproveClaim(claimPdaStr: string) {
    if (!wallet.publicKey) {
      push({
        type: "error",
        title: "Connect wallet",
        description: "Connect the organizer wallet to approve claims.",
      });
      return;
    }

    setBusyApprove(claimPdaStr);

    try {
      const program = getProgram(connection, wallet);
      const claimPk = new PublicKey(claimPdaStr);

      const claimAccountInfo = await connection.getAccountInfo(claimPk);
      if (!claimAccountInfo) {
        push({
          type: "error",
          title: "Claim not found",
          description: "No account exists at that claim PDA.",
        });
        return;
      }

      const claimAccount = await (program.account as any).claim.fetch(claimPk);

      if (!isPendingStatus(claimAccount.status)) {
        push({
          type: "info",
          title: "Claim not pending",
          description: "This claim is no longer pending approval.",
        });
        await loadPendingClaims();
        return;
      }

      const organizerPk = claimAccount.organizer as PublicKey;
      const claimantPk = claimAccount.claimant as PublicKey;

      const [proofPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("proof"),
          organizerPk.toBuffer(),
          claimantPk.toBuffer(),
          claimPk.toBuffer(),
        ],
        program.programId
      );

      const existingProof = await connection.getAccountInfo(proofPda);
      if (existingProof) {
        setLastProof(proofPda.toBase58());

        push({
          type: "info",
          title: "Proof already exists",
          description: "This claim has already been approved.",
          actionLabel: "View proof",
          onAction: () =>
            window.open(explorerAddressUrl(proofPda.toBase58()), "_blank"),
        });

        await loadPendingClaims();
        return;
      }

      const sig = await program.methods
        .approveClaim()
        .accountsPartial({
          authority: wallet.publicKey,
          organizer: organizerPk,
          claim: claimPk,
          proof: proofPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      setLastProof(proofPda.toBase58());

      push({
        type: "success",
        title: "Proof issued ✅",
        description: `Proof: ${shortPk(proofPda.toBase58())}`,
        actionLabel: "View tx",
        onAction: () => window.open(explorerTxUrl(sig), "_blank"),
      });

      console.log("approveClaim tx:", sig);
      console.log("claim:", claimPk.toBase58());
      console.log("organizer:", organizerPk.toBase58());
      console.log("claimant:", claimantPk.toBase58());
      console.log("proof:", proofPda.toBase58());

      await loadPendingClaims();
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
      setBusyApprove(null);
    }
  }

  const pendingCount = useMemo(() => pendingClaims.length, [pendingClaims]);

  return (
    <div className="space-y-6">
      <div className="card p-6 sm:p-8">
        <div className="badge">Validator</div>
        <h1 className="h1 mt-3">Approve claims and issue proofs</h1>
        <p className="p mt-2">
          In MVP, the organizer authority approves pending claims and writes a
          canonical Proof record on-chain.
        </p>
      </div>

      <div className="card-solid p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="h2">Pending claims</h2>
            <p className="p mt-2">
              Claims for the connected organizer wallet are loaded automatically.
            </p>
          </div>

          <button
            className="btn-secondary"
            onClick={() => void loadPendingClaims()}
            disabled={!connected || busyRefresh}
            type="button"
          >
            {busyRefresh ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {!wallet.publicKey ? (
          <div className="mt-4 text-sm opacity-70">
            Connect the organizer wallet first.
          </div>
        ) : null}

        {wallet.publicKey ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/60 p-4 dark:bg-white/5">
            <div className="text-xs opacity-70">Organizer wallet</div>
            <div className="mt-1 font-mono text-xs break-all opacity-90">
              {wallet.publicKey.toBase58()}
            </div>
            <div className="mt-3 text-sm">
              Pending claims: <span className="font-semibold">{pendingCount}</span>
            </div>
          </div>
        ) : null}

        {connected && pendingClaims.length === 0 ? (
          <div className="mt-4 text-sm opacity-70">
            No pending claims found for this organizer.
          </div>
        ) : null}

        {pendingClaims.length > 0 ? (
          <div className="mt-5 space-y-3">
            {pendingClaims.map((claim) => (
              <div
                key={claim.claimPda}
                className="rounded-3xl border border-white/10 bg-white/60 p-5 dark:bg-white/5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {claim.eventTitle ? claim.eventTitle : `Claim ${shortPk(claim.claimPda)}`}
                    </div>

                    <div className="mt-2 space-y-1 text-xs opacity-80">
                      <div>
                        Claim PDA:{" "}
                        <span className="font-mono break-all">{claim.claimPda}</span>
                      </div>
                      <div>
                        Claimant:{" "}
                        <span className="font-mono break-all">{claim.claimant}</span>
                      </div>
                      <div>Status: {claim.statusLabel}</div>
                      <div>Occurred: {formatDateTime(claim.occurredTs)}</div>
                      <div>Submitted: {formatDateTime(claim.submittedAt)}</div>
                      {claim.event ? (
                        <div>
                          Event PDA:{" "}
                          <span className="font-mono break-all">{claim.event}</span>
                        </div>
                      ) : null}
                      {claim.actionType ? (
                        <div>
                          Action PDA:{" "}
                          <span className="font-mono break-all">
                            {claim.actionType}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      className="btn-primary"
                      onClick={() => void onApproveClaim(claim.claimPda)}
                      disabled={busyApprove === claim.claimPda}
                      type="button"
                    >
                      {busyApprove === claim.claimPda ? "Approving…" : "Approve"}
                    </button>

                    <button
                      className="btn-secondary"
                      onClick={() =>
                        window.open(explorerAddressUrl(claim.claimPda), "_blank")
                      }
                      type="button"
                    >
                      View claim
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
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
              onClick={() => window.open(explorerAddressUrl(lastProof), "_blank")}
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