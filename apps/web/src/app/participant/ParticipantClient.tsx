"use client";

import React, { useEffect, useMemo, useState } from "react";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CLAIM_KIND_POA: any = { attendedEvent: {} };

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

export default function ParticipantPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { push } = useToast();
  const sp = useSearchParams();

  const [mounted, setMounted] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [previewTime, setPreviewTime] = useState("");

  // From share link:
  // /participant?oa=<organizerAuthority>&e=<eventPda>&at=<actionTypePda>&c=<claimCode>&t=<title>&emo=<emoji>&cover=<coverUrl>
  const [organizerAuthority, setOrganizerAuthority] = useState("");
  const [eventPdaStr, setEventPdaStr] = useState("");
  const [actionTypePdaStr, setActionTypePdaStr] = useState("");
  const [claimCode, setClaimCode] = useState("");
  const [occurredLocal, setOccurredLocal] = useState("");

  const [title, setTitle] = useState("Check-in");
  const [emoji, setEmoji] = useState("🚀");
  const [cover, setCover] = useState<string | undefined>(undefined);

  const [busy, setBusy] = useState(false);
  const [claims, setClaims] = useState<StoredClaim[]>([]);
  const [celebrate, setCelebrate] = useState(false);

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
        setClaims(JSON.parse(cl));
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveClaims(next: StoredClaim[]) {
    setClaims(next);
    window.localStorage.setItem(LS_CLAIMS, JSON.stringify(next));
  }

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
      };

      saveClaims([stored, ...claims].slice(0, 12));

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

  return (
    <div className="space-y-6">
      <Celebration fire={celebrate} />

      <div className="card-social p-6 sm:p-8">
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
            <p className="p mt-2">
              {isLinkPrefilled
                ? "This page is pre-filled from the organizer’s link. Tap check-in — it’s like posting a story."
                : "Paste a link from an organizer. Soon: scan QR as the default."}
            </p>
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
      </div>

      <div className="card-social p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3">
            <div
              className="rounded-3xl border border-white/10 overflow-hidden mb-5"
              style={heroBg}
            >
              <div
                className={`p-5 sm:p-6 ${
                  cover ? "bg-black/45" : "bg-white/55 dark:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-2xl bg-white/70 dark:bg-white/10 border border-white/10 flex items-center justify-center">
                      <span className="text-xl">{storyEmoji}</span>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[color:var(--text-primary)]">
                        {storyTitle}
                      </div>
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
                  Tap <span className="font-semibold">Check in</span> to post your
                  attendance proof.
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  Optional. If you don’t have one, we’ll keep the premium
                  gradient look.
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
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
                    className="input mt-2"
                    type="datetime-local"
                    value={occurredLocal}
                    onChange={(e) => setOccurredLocal(e.target.value)}
                  />
                  <div className="mt-2 text-xs opacity-70">
                    Must be inside the event window (start → end).
                  </div>
                </div>
              </div>

              <button
                className="btn-primary w-full shine"
                disabled={!canSubmit}
                onClick={onSubmitClaim}
                type="button"
              >
                {busy ? "Checking in…" : "✅ Check in"}
              </button>

              {!wallet.publicKey ? (
                <div className="mt-2 text-xs opacity-70">
                  Tap “Select Wallet” (top right) to connect, then check in.
                </div>
              ) : null}

              {!actionTypePdaStr.trim() ? (
                <div className="mt-2 text-xs opacity-70">
                  This link does not include an action type. The page will still
                  try the attendance flow, but organizer links should include it
                  silently in the future for the cleanest check-in UX.
                </div>
              ) : null}
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-3xl border border-white/10 bg-white/60 dark:bg-white/5 p-5">
              <div className="text-sm font-semibold">What happens next?</div>
              <div className="mt-2 text-sm opacity-80 leading-relaxed">
                Your check-in is recorded as a pending proof. The
                organizer/validator approves it, then it becomes a verified proof
                you can share.
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-white/60 dark:bg-white/5 p-4">
                <div className="text-xs opacity-70">Pro tip</div>
                <div className="mt-1 text-sm opacity-90">
                  Organizers should share the claim link/QR. Attendees just tap
                  and check in.
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/60 dark:bg-white/5 p-5">
              <div className="text-sm font-semibold">Your last check-ins</div>
              <div className="mt-2 text-sm opacity-80">Saved on this device.</div>

              {claims.length === 0 ? (
                <div className="mt-3 text-sm opacity-70">No check-ins yet.</div>
              ) : (
                <div className="mt-3 space-y-3">
                  {claims.slice(0, 4).map((c) => (
                    <div
                      key={c.claimPda}
                      className="rounded-2xl border border-white/10 bg-white/65 dark:bg-white/5 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">
                            {(c.emoji || "✅")} {(c.title || "Check-in")}
                          </div>
                          <div className="mt-1 font-mono text-xs opacity-80 break-all">
                            {c.claimPda}
                          </div>
                        </div>
                        <button
                          className="btn-secondary px-3 py-2"
                          onClick={() =>
                            window.open(explorerAddressUrl(c.claimPda), "_blank")
                          }
                          type="button"
                        >
                          View
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="btn-secondary"
                          onClick={() => navigator.clipboard.writeText(c.claimPda)}
                          type="button"
                        >
                          Copy PDA
                        </button>
                        {c.tx ? (
                          <button
                            className="btn-secondary"
                            onClick={() =>
                              window.open(explorerTxUrl(c.tx!), "_blank")
                            }
                            type="button"
                          >
                            Tx
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-3xl border border-white/10 bg-white/50 dark:bg-white/5 p-5 opacity-90">
              <div className="text-sm font-semibold">Next: PRA = “Action posts”</div>
              <div className="mt-2 text-sm opacity-80">
                Real-world actions will feel like posting a story with an evidence
                hash + location cell.
              </div>
            </div>
          </div>
        </div>
      </div>

      {isLinkPrefilled ? (
        <div className="card-social p-6">
          <div className="text-sm font-semibold">Share this check-in link</div>
          <div className="mt-2 text-sm opacity-80">
            Handy if a friend is beside you and needs the same event link.
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
        </div>
      ) : null}
    </div>
  );
}