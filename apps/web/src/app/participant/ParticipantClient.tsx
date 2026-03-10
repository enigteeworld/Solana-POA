"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SendTransactionError,
  SystemProgram,
} from "@solana/web3.js";
import { useSearchParams } from "next/navigation";

import { getProgram } from "@/lib/solana";
import { claimPda, organizerPda } from "@/lib/pdas";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/explorer";
import { useToast } from "@/components/ui/toast";
import { Celebration } from "@/components/celebration";
import { ShareRow } from "@/components/share-row";

const LS_CLAIMS = "openrails.claims";
const EMPTY_PK = "11111111111111111111111111111111";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CLAIM_KIND_POA: any = { attendedEvent: {} };

type StoredClaimStatus = "pending" | "approved" | "rejected" | "unknown";

type StoredClaim = {
  claimPda: string;
  organizerAuthority: string;
  eventPda?: string;
  actionTypePda?: string;
  claimCode?: string;
  tx?: string;
  occurredTs: number;
  title?: string;
  emoji?: string;
  cover?: string;
  status?: StoredClaimStatus;
  proofPda?: string;
  proofTx?: string;
  submittedAt?: number;
};

function shortPk(pk: string) {
  return `${pk.slice(0, 6)}…${pk.slice(-6)}`;
}

function nowLocalInput() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function toUnixSeconds(dtLocal: string) {
  const ms = new Date(dtLocal).getTime();
  return Math.floor(ms / 1000);
}

function formatDateTime(unixSeconds?: number) {
  if (!unixSeconds || !Number.isFinite(unixSeconds)) return "—";
  return new Date(unixSeconds * 1000).toLocaleString();
}

function getStatusLabel(status: unknown): StoredClaimStatus {
  if (!status || typeof status !== "object") return "unknown";
  if ("pending" in (status as Record<string, unknown>)) return "pending";
  if ("approved" in (status as Record<string, unknown>)) return "approved";
  if ("rejected" in (status as Record<string, unknown>)) return "rejected";
  return "unknown";
}

function statusText(status?: StoredClaimStatus) {
  switch (status) {
    case "approved":
      return "Verified";
    case "pending":
      return "Pending";
    case "rejected":
      return "Rejected";
    default:
      return "Unknown";
  }
}

function StatusChip({
  icon,
  text,
}: {
  icon: string;
  text: string;
}) {
  return (
    <div className="pill">
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

export default function ParticipantPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { push } = useToast();
  const sp = useSearchParams();

  const [mounted, setMounted] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [previewTime, setPreviewTime] = useState("");

  const [organizerAuthority, setOrganizerAuthority] = useState("");
  const [eventPdaStr, setEventPdaStr] = useState("");
  const [actionTypePdaStr, setActionTypePdaStr] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [occurredLocal, setOccurredLocal] = useState("");

  const [title, setTitle] = useState("Check-in");
  const [emoji, setEmoji] = useState("🚀");
  const [cover, setCover] = useState<string | undefined>(undefined);

  const [busy, setBusy] = useState(false);
  const [refreshingClaims, setRefreshingClaims] = useState(false);
  const [claims, setClaims] = useState<StoredClaim[]>([]);
  const [celebrate, setCelebrate] = useState(false);

  const claimsRef = useRef<StoredClaim[]>([]);

  useEffect(() => {
    claimsRef.current = claims;
  }, [claims]);

  const isLinkPrefilled = useMemo(() => {
    return !!sp.get("oa") || !!sp.get("e") || !!sp.get("c");
  }, [sp]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!occurredLocal) setOccurredLocal(nowLocalInput());
    if (!previewTime) setPreviewTime(new Date().toLocaleString());
    if (!currentUrl) setCurrentUrl(window.location.href);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  useEffect(() => {
    const oa = sp.get("oa");
    const e = sp.get("e");
    const at = sp.get("at");
    const c = sp.get("c");
    const t = sp.get("t");
    const emo = sp.get("emo");
    const cov = sp.get("cover");

    if (oa) setOrganizerAuthority(oa);
    if (e) setEventPdaStr(e);
    if (at) setActionTypePdaStr(at);
    if (c) setClaimCode(c);

    if (t) setTitle(t);
    if (emo) setEmoji(emo);
    if (cov) setCover(cov);

    const cl = window.localStorage.getItem(LS_CLAIMS);
    if (cl) {
      try {
        const parsed = JSON.parse(cl) as StoredClaim[];
        setClaims(parsed);
        claimsRef.current = parsed;
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveClaims(next: StoredClaim[]) {
    claimsRef.current = next;
    setClaims(next);
    window.localStorage.setItem(LS_CLAIMS, JSON.stringify(next));
  }

  const refreshClaimStatuses = useCallback(
    async (sourceClaims?: StoredClaim[]) => {
      const targetClaims = sourceClaims ?? claimsRef.current;
      if (!wallet.publicKey || targetClaims.length === 0) return;

      setRefreshingClaims(true);
      try {
        const program = getProgram(connection, wallet);

        const nextClaims = await Promise.all(
          targetClaims.map(async (stored) => {
            try {
              const claimPk = new PublicKey(stored.claimPda);
              const claimAccount = await (program.account as any).claim.fetch(claimPk);

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

              const proofInfo = await connection.getAccountInfo(proofPda);

              return {
                ...stored,
                organizerAuthority:
                  stored.organizerAuthority ||
                  claimAccount.organizerAuthority?.toBase58?.() ||
                  stored.organizerAuthority,
                eventPda:
                  stored.eventPda ||
                  (claimAccount.event?.toBase58?.() &&
                  claimAccount.event.toBase58() !== EMPTY_PK
                    ? claimAccount.event.toBase58()
                    : undefined),
                actionTypePda:
                  stored.actionTypePda ||
                  (claimAccount.actionType?.toBase58?.() &&
                  claimAccount.actionType.toBase58() !== EMPTY_PK
                    ? claimAccount.actionType.toBase58()
                    : undefined),
                submittedAt:
                  typeof claimAccount.submittedAt?.toNumber === "function"
                    ? claimAccount.submittedAt.toNumber()
                    : stored.submittedAt,
                status: proofInfo ? "approved" : getStatusLabel(claimAccount.status),
                proofPda: proofInfo ? proofPda.toBase58() : stored.proofPda,
              } satisfies StoredClaim;
            } catch {
              return stored;
            }
          })
        );

        saveClaims(nextClaims);
      } finally {
        setRefreshingClaims(false);
      }
    },
    [connection, wallet]
  );

  useEffect(() => {
    if (!wallet.publicKey) return;
    if (claimsRef.current.length === 0) return;
    void refreshClaimStatuses(claimsRef.current);
  }, [wallet.publicKey, refreshClaimStatuses]);

  const canSubmit = useMemo(() => {
    if (!wallet.publicKey) return false;
    if (busy) return false;
    if (organizerAuthority.trim().length < 32) return false;
    if (eventPdaStr.trim().length < 32) return false;
    if (claimCode.trim().length < 2) return false;
    if (!occurredLocal) return false;

    const ts = toUnixSeconds(occurredLocal);
    return Number.isFinite(ts) && ts > 0;
  }, [
    wallet.publicKey,
    busy,
    organizerAuthority,
    eventPdaStr,
    claimCode,
    occurredLocal,
  ]);

  async function onSubmitClaim() {
    if (!wallet.publicKey) {
      push({
        type: "error",
        title: "Connect wallet",
        description: "Connect your wallet to check in.",
      });
      return;
    }

    setBusy(true);
    try {
      const program = getProgram(connection, wallet);

      const organizerAuthorityPk = new PublicKey(organizerAuthority.trim());
      const [organizer] = await organizerPda(organizerAuthorityPk);

      const eventPk = new PublicKey(eventPdaStr.trim());

      let actionTypePk: PublicKey | null = null;
      if (actionTypePdaStr.trim()) {
        actionTypePk = new PublicKey(actionTypePdaStr.trim());
      }

      const claimId = Keypair.generate().publicKey;
      const [claim] = await claimPda(organizer, wallet.publicKey, claimId);

      const occurredTs = new BN(toUnixSeconds(occurredLocal));

      const method = program.methods.submitClaim(
        CLAIM_KIND_POA,
        claimCode.trim() ? claimCode.trim() : null,
        null,
        null,
        null,
        occurredTs
      );

      const partialAccounts = {
        claimant: wallet.publicKey,
        organizer,
        organizerAuthority: organizerAuthorityPk,
        event: eventPk,
        actionType: actionTypePk,
        claim,
        claimId,
        systemProgram: SystemProgram.programId,
      };

      const strictAccounts = {
        claimant: wallet.publicKey,
        organizer,
        organizerAuthority: organizerAuthorityPk,
        event: eventPk,
        claim,
        claimId,
        systemProgram: SystemProgram.programId,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m: any = method;
      const sig =
        typeof m.accountsPartial === "function"
          ? await m.accountsPartial(partialAccounts).rpc()
          : await m.accounts(strictAccounts).rpc();

      const stored: StoredClaim = {
        claimPda: claim.toBase58(),
        organizerAuthority: organizerAuthorityPk.toBase58(),
        eventPda: eventPk.toBase58(),
        actionTypePda: actionTypePk?.toBase58(),
        claimCode: claimCode.trim(),
        tx: sig,
        occurredTs: occurredTs.toNumber(),
        title,
        emoji,
        cover,
        status: "pending",
        submittedAt: Math.floor(Date.now() / 1000),
      };

      const nextClaims = [stored, ...claimsRef.current].slice(0, 12);
      saveClaims(nextClaims);

      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1200);

      push({
        type: "success",
        title: "Checked in 🎉",
        description: `Claim: ${shortPk(claim.toBase58())}`,
        actionLabel: "View tx",
        onAction: () => window.open(explorerTxUrl(sig), "_blank"),
      });
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
          title: "Check-in failed",
          description: e.message || "SendTransactionError",
          actionLabel: logs?.length ? "Show logs" : undefined,
          onAction: logs?.length
            ? () => console.log("Transaction logs:", logs)
            : undefined,
        });
        console.error(e, logs);
        return;
      }

      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Transaction failed";
      push({ type: "error", title: "Check-in failed", description: msg });
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  const storyTitle = title?.trim() || "Check-in";
  const storyEmoji = emoji?.trim() || "🚀";
  const heroBg = cover?.trim()
    ? { backgroundImage: `url(${cover})` }
    : undefined;

  const verifiedClaims = claims.filter((c) => c.status === "approved");
  const pendingClaims = claims.filter((c) => c.status === "pending");
  const latestVerified = verifiedClaims[0];
  const latestClaim = claims[0];

  return (
    <div className="space-y-5">
      <Celebration fire={celebrate} />

      <div className="card-social overflow-hidden">
        <div
          className="p-6 sm:p-8"
          style={heroBg}
        >
          <div className={cover ? "rounded-[28px] bg-black/40 p-6 sm:p-7" : ""}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="pill">
                  <span>Participant</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.7)]" />
                  <span className="opacity-80">Check-in</span>
                </div>

                <h1 className="h1 mt-4">
                  {storyEmoji} {storyTitle}
                </h1>
                <p className="p mt-3 max-w-2xl">
                  {isLinkPrefilled
                    ? "Open the event, tap once, and your attendance gets posted like a story."
                    : "Open an organizer link or QR to check in and unlock a shareable attendance badge."}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusChip icon="⏳" text={`${pendingClaims.length} pending`} />
                  <StatusChip icon="✅" text={`${verifiedClaims.length} verified`} />
                </div>
              </div>

              <div className="hidden sm:flex flex-col items-end gap-2">
                {wallet.publicKey ? (
                  <div className="pill">
                    <span className="opacity-80">Connected</span>
                    <span className="font-mono">
                      {shortPk(wallet.publicKey.toBase58())}
                    </span>
                  </div>
                ) : (
                  <div className="pill opacity-80">Connect wallet to post</div>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                className="btn-primary shine w-full"
                disabled={!canSubmit}
                onClick={onSubmitClaim}
                type="button"
              >
                {busy ? "Checking in…" : "✅ Check in"}
              </button>

              <button
                className="btn-secondary w-full"
                onClick={() => void refreshClaimStatuses(claimsRef.current)}
                disabled={refreshingClaims || claims.length === 0}
                type="button"
              >
                {refreshingClaims ? "Updating…" : "Refresh status"}
              </button>
            </div>

            <div className="mt-3 text-xs opacity-75">
              Your check-in first appears as pending. Once approved, it becomes a verified attendance badge you can share.
            </div>
          </div>
        </div>
      </div>

      {latestVerified ? (
        <div className="card-social p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="pill">🏅 Attendance badge</div>
              <div className="mt-3 text-sm font-semibold">
                Your latest verified badge
              </div>
              <div className="mt-1 text-sm opacity-80">
                Designed to feel like a social proof card, not a blockchain receipt.
              </div>
            </div>
          </div>

          <div
            className="mt-5 rounded-3xl overflow-hidden border border-white/10"
            style={
              latestVerified.cover?.trim()
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.20), rgba(0,0,0,0.55)), url(${latestVerified.cover})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : {
                    background:
                      "linear-gradient(135deg, rgba(34,197,94,0.22), rgba(59,130,246,0.22), rgba(168,85,247,0.22))",
                  }
            }
          >
            <div className="bg-black/20 p-5 sm:p-6 text-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="pill bg-white/15 text-white border-white/10">
                  <span>✅</span>
                  <span>Verified attendance</span>
                </div>
                <div className="pill bg-white/15 text-white border-white/10">
                  <span>🏅</span>
                  <span>Badge unlocked</span>
                </div>
              </div>

              <div className="mt-5 flex items-start gap-3">
                <div className="h-16 w-16 rounded-3xl bg-white/20 border border-white/20 flex items-center justify-center text-3xl">
                  {latestVerified.emoji || "🎟️"}
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-semibold">
                    {latestVerified.title || "Attendance badge"}
                  </div>
                  <div className="mt-1 text-sm text-white/80">
                    Attended on {formatDateTime(latestVerified.occurredTs)}
                  </div>
                </div>
              </div>

              <div className="mt-5 rounded-3xl border border-white/10 bg-white/10 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-white/70">
                  Open Rails
                </div>
                <div className="mt-2 text-lg font-semibold">Attendance Badge</div>
                <div className="mt-2 text-sm text-white/80">
                  Verified proof recorded on-chain. A shareable proof that you showed up.
                </div>
              </div>

              <div className="mt-5">
                <ShareRow
                  title={`I earned an Open Rails attendance badge for ${latestVerified.title || "this event"} 🏅`}
                  text={`Verified attendance: ${latestVerified.emoji || "🎟️"} ${latestVerified.title || "Event"} • recorded on-chain`}
                  url={
                    latestVerified.proofPda
                      ? explorerAddressUrl(latestVerified.proofPda)
                      : explorerAddressUrl(latestVerified.claimPda)
                  }
                  onCopied={() =>
                    push({
                      type: "success",
                      title: "Copied",
                      description: "Badge link copied to clipboard.",
                    })
                  }
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {latestVerified.proofPda ? (
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      window.open(explorerAddressUrl(latestVerified.proofPda!), "_blank")
                    }
                    type="button"
                  >
                    View badge
                  </button>
                ) : null}
                <button
                  className="btn-secondary"
                  onClick={() =>
                    window.open(explorerAddressUrl(latestVerified.claimPda), "_blank")
                  }
                  type="button"
                >
                  View claim
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card-social p-6">
        <div className="space-y-4">
          <div
            className="rounded-3xl border border-white/10 overflow-hidden"
            style={heroBg}
          >
            <div
              className={`p-5 sm:p-6 ${
                cover ? "bg-black/45 text-white" : "bg-white/55 dark:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-3xl bg-white/70 dark:bg-white/10 border border-white/10 flex items-center justify-center">
                    <span className="text-2xl">{storyEmoji}</span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{storyTitle}</div>
                    <div className="text-xs opacity-80">
                      {mounted ? previewTime : "\u00A0"}
                    </div>
                  </div>
                </div>

                <div className="pill">
                  <span>🔒</span>
                  <span className="opacity-80">On-chain</span>
                </div>
              </div>

              <div className="mt-4 text-sm opacity-90">
                One tap check-in. Then wait for approval to unlock your attendance badge.
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Story title</label>
              <input
                className="input mt-2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Solana Builders Meetup"
              />
            </div>
            <div>
              <label className="label">Emoji</label>
              <input
                className="input mt-2"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="🚀"
              />
            </div>
          </div>

          <div>
            <label className="label">Cover image URL (optional)</label>
            <input
              className="input mt-2"
              value={cover || ""}
              onChange={(e) =>
                setCover(e.target.value.trim() ? e.target.value : undefined)
              }
              placeholder="https://… (banner image)"
            />
            <div className="mt-2 text-xs opacity-70">
              Optional. If blank, the app keeps the premium gradient look.
            </div>
          </div>

          <div>
            <label className="label">Event code</label>
            <input
              className="input mt-2"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value)}
              placeholder="From QR/link"
            />
          </div>

          <div>
            <label className="label">When did you attend?</label>
            <input
              className="input mt-2 w-full min-w-0 appearance-none"
              type="datetime-local"
              value={occurredLocal}
              onChange={(e) => setOccurredLocal(e.target.value)}
            />
            <div className="mt-2 text-xs opacity-70">
              Must be inside the event window.
            </div>
          </div>

          <details className="rounded-3xl border border-white/10 bg-white/50 dark:bg-white/5 p-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Advanced event details
            </summary>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div>
                <label className="label">Organizer authority</label>
                <input
                  className="input mt-2 font-mono"
                  value={organizerAuthority}
                  onChange={(e) => setOrganizerAuthority(e.target.value)}
                  placeholder="Filled from link"
                />
              </div>

              <div>
                <label className="label">Event PDA</label>
                <input
                  className="input mt-2 font-mono"
                  value={eventPdaStr}
                  onChange={(e) => setEventPdaStr(e.target.value)}
                  placeholder="Filled from link"
                />
              </div>

              <div>
                <label className="label">Action Type PDA (optional)</label>
                <input
                  className="input mt-2 font-mono"
                  value={actionTypePdaStr}
                  onChange={(e) => setActionTypePdaStr(e.target.value)}
                  placeholder="Filled from link"
                />
              </div>
            </div>
          </details>
        </div>
      </div>

      <details className="card-social p-6">
        <summary className="cursor-pointer">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Your activity</div>
              <div className="mt-1 text-sm opacity-80">
                A lighter feed view of your check-ins and badges.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusChip icon="⏳" text={`${pendingClaims.length}`} />
              <StatusChip icon="✅" text={`${verifiedClaims.length}`} />
            </div>
          </div>
        </summary>

        {claims.length === 0 ? (
          <div className="mt-4 text-sm opacity-70">No check-ins yet.</div>
        ) : (
          <div className="mt-5 space-y-3">
            {claims.slice(0, 6).map((c) => {
              const shareUrl = c.proofPda
                ? explorerAddressUrl(c.proofPda)
                : explorerAddressUrl(c.claimPda);

              return (
                <div
                  key={c.claimPda}
                  className="rounded-2xl border border-white/10 bg-white/65 dark:bg-white/5 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        {(c.emoji || "✅")} {(c.title || "Check-in")}
                      </div>
                      <div className="mt-1 text-xs opacity-75">
                        {statusText(c.status)} • {formatDateTime(c.occurredTs)}
                      </div>
                    </div>

                    <div className="pill">
                      {c.status === "approved" ? "🏅 Verified" : "⏳ Pending"}
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/50 dark:bg-white/5 p-3">
                    <div className="text-xs uppercase tracking-[0.16em] opacity-65">
                      Open Rails
                    </div>
                    <div className="mt-1 text-sm font-semibold">
                      {c.status === "approved"
                        ? "Attendance Badge"
                        : "Pending Attendance Proof"}
                    </div>
                    <div className="mt-1 text-sm opacity-80">
                      {c.status === "approved"
                        ? "Verified and ready to share."
                        : "Waiting for organizer approval."}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="btn-secondary"
                      onClick={() =>
                        window.open(
                          explorerAddressUrl(c.proofPda || c.claimPda),
                          "_blank"
                        )
                      }
                      type="button"
                    >
                      {c.status === "approved" ? "View badge" : "View claim"}
                    </button>

                    {c.tx ? (
                      <button
                        className="btn-secondary"
                        onClick={() => window.open(explorerTxUrl(c.tx!), "_blank")}
                        type="button"
                      >
                        Tx
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3">
                    <ShareRow
                      title={
                        c.status === "approved"
                          ? `I earned an attendance badge for ${c.title || "this event"} 🏅`
                          : `I checked in to ${c.title || "this event"}`
                      }
                      text={
                        c.status === "approved"
                          ? `${c.emoji || "🎟️"} Verified attendance badge unlocked`
                          : `${c.emoji || "🎟️"} Check-in submitted and awaiting approval`
                      }
                      url={shareUrl}
                      onCopied={() =>
                        push({
                          type: "success",
                          title: "Copied",
                          description:
                            c.status === "approved"
                              ? "Badge link copied to clipboard."
                              : "Claim link copied to clipboard.",
                        })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </details>

      {isLinkPrefilled ? (
        <details className="card-social p-6">
          <summary className="cursor-pointer text-sm font-semibold">
            Share this check-in link
          </summary>

          <div className="mt-2 text-sm opacity-80">
            Handy if someone beside you needs the same event link.
          </div>

          <div className="mt-4">
            {mounted ? (
              <ShareRow
                title="Open Rails check-in"
                text={`${storyEmoji} ${storyTitle}`}
                url={currentUrl}
                onCopied={() =>
                  push({
                    type: "success",
                    title: "Copied",
                    description: "Link copied to clipboard.",
                  })
                }
              />
            ) : (
              <div className="h-12 rounded-2xl border border-white/10 bg-white/40 dark:bg-white/5" />
            )}
          </div>
        </details>
      ) : null}
    </div>
  );
}