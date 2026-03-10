"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  Keypair,
  PublicKey,
  SendTransactionError,
  SystemProgram,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

import { getProgram } from "@/lib/solana";
import { actionTypePda, eventPda, organizerPda } from "@/lib/pdas";
import { useToast } from "@/components/ui/toast";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/explorer";
import { copyToClipboard } from "@/lib/share";
import { QrModal } from "@/components/qr-modal";

import { Celebration } from "@/components/celebration";
import { ShareRow } from "@/components/share-row";

const LS_ORG_PDA = "openrails.organizerPda";
const LS_EVENTS = "openrails.events";
const LS_EVENT_ACTION_TYPES = "openrails.eventActionTypes";

type EventActionTypeMap = Record<string, string>;

function shortPk(pk: string) {
  return `${pk.slice(0, 6)}…${pk.slice(-6)}`;
}

function toUnixSeconds(dtLocal: string) {
  const ms = new Date(dtLocal).getTime();
  return Math.floor(ms / 1000);
}

function nowLocalInputPlus(minutes: number) {
  const d = new Date(Date.now() + minutes * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function makeClaimCodeFallback(name: string) {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug || "event"}-${rand}`;
}

function makeActionCode(name: string) {
  const slug = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
  return `ATTENDED_${slug || "EVENT"}`.slice(0, 32);
}

async function waitForSignature(
  connection: Connection,
  signature: string,
  timeoutMs = 60000
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const res = await connection.getSignatureStatuses([signature]);
    const status = res.value[0];

    if (status?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
    }

    if (
      status?.confirmationStatus === "confirmed" ||
      status?.confirmationStatus === "finalized"
    ) {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(
    `Confirmation delayed. Check signature in Explorer: ${signature}`
  );
}

type StoredEvent = {
  name: string;
  eventPda: string;
  eventId: string;
  actionTypePda?: string;
  actionTypeCode?: string;
  startTs: number;
  endTs: number;
  claimCode: string;
  emoji?: string;
  cover?: string;
};

function statusChip(icon: string, text: string) {
  return (
    <div className="pill">
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

export default function OrganizerPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { push } = useToast();

  const [mounted, setMounted] = useState(false);
  const [previewTime, setPreviewTime] = useState("");

  const [orgName, setOrgName] = useState("");
  const [busyOrg, setBusyOrg] = useState(false);
  const [savedOrgPda, setSavedOrgPda] = useState<string | null>(null);

  const [eventName, setEventName] = useState("");
  const [eventEmoji, setEventEmoji] = useState("🎓");
  const [eventCover, setEventCover] = useState("");
  const [eventUri, setEventUri] = useState("");
  const [startLocal, setStartLocal] = useState(nowLocalInputPlus(5));
  const [endLocal, setEndLocal] = useState(nowLocalInputPlus(65));
  const [claimCode, setClaimCode] = useState("");
  const [busyEvent, setBusyEvent] = useState(false);

  const [events, setEvents] = useState<StoredEvent[]>([]);

  const [shareUrl, setShareUrl] = useState<string>("");
  const [shareTitle, setShareTitle] = useState<string>("");
  const [shareText, setShareText] = useState<string>("");

  const [celebrate, setCelebrate] = useState(false);

  const [qrOpen, setQrOpen] = useState(false);
  const [qrTitle, setQrTitle] = useState("");
  const [qrUrl, setQrUrl] = useState("");

  useEffect(() => {
    setMounted(true);
    setPreviewTime(new Date().toLocaleString());

    const v = window.localStorage.getItem(LS_ORG_PDA);
    if (v) setSavedOrgPda(v);

    const ev = window.localStorage.getItem(LS_EVENTS);
    if (ev) {
      try {
        setEvents(JSON.parse(ev));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (!claimCode.trim() && eventName.trim()) {
      setClaimCode(makeClaimCodeFallback(eventName));
    }
  }, [eventName, claimCode]);

  useEffect(() => {
    if (!mounted) return;
    setPreviewTime(new Date().toLocaleString());
  }, [mounted, eventName, eventEmoji, eventCover]);

  function saveEvents(next: StoredEvent[]) {
    setEvents(next);
    window.localStorage.setItem(LS_EVENTS, JSON.stringify(next));
  }

  function saveEventActionType(eventPdaStr: string, actionTypePdaStr: string) {
    try {
      const raw = window.localStorage.getItem(LS_EVENT_ACTION_TYPES);
      const parsed = raw ? (JSON.parse(raw) as EventActionTypeMap) : {};
      const next: EventActionTypeMap = {
        ...parsed,
        [eventPdaStr]: actionTypePdaStr,
      };
      window.localStorage.setItem(LS_EVENT_ACTION_TYPES, JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  function buildParticipantLink(params: {
    organizerAuthority: string;
    eventPda: string;
    actionTypePda?: string;
    claimCode: string;
    title: string;
    emoji: string;
    cover?: string;
  }) {
    const u = new URL(`${window.location.origin}/participant`);
    u.searchParams.set("oa", params.organizerAuthority);
    u.searchParams.set("e", params.eventPda);
    if (params.actionTypePda) u.searchParams.set("at", params.actionTypePda);
    u.searchParams.set("c", params.claimCode);
    u.searchParams.set("t", params.title);
    u.searchParams.set("emo", params.emoji);
    if (params.cover) u.searchParams.set("cover", params.cover);
    return u.toString();
  }

  function claimLinkFor(ev: StoredEvent) {
    const oa = wallet.publicKey?.toBase58() || "";
    const title = ev.name;
    const emoji = ev.emoji || "🎓";
    const cover = ev.cover?.trim() ? ev.cover.trim() : undefined;

    return buildParticipantLink({
      organizerAuthority: oa,
      eventPda: ev.eventPda,
      actionTypePda: ev.actionTypePda,
      claimCode: ev.claimCode,
      title,
      emoji,
      cover,
    });
  }

  function openSharePanelFor(ev: StoredEvent) {
    if (!wallet.publicKey) return;

    const url = claimLinkFor(ev);
    const title = `Check in: ${ev.name}`;
    const emoji = ev.emoji || "🎓";
    const text = `${emoji} ${ev.name} — tap to check in`;

    setShareUrl(url);
    setShareTitle(title);
    setShareText(text);
  }

  async function onCopyLink(ev: StoredEvent) {
    if (!wallet.publicKey) {
      push({
        type: "error",
        title: "Connect wallet",
        description: "Connect your organizer wallet to generate a share link.",
      });
      return;
    }
    const url = claimLinkFor(ev);
    await copyToClipboard(url);
    push({
      type: "success",
      title: "Link copied",
      description: "Paste into WhatsApp/Instagram/X.",
    });
  }

  function onShowQr(ev: StoredEvent) {
    if (!wallet.publicKey) {
      push({
        type: "error",
        title: "Connect wallet",
        description: "Connect your organizer wallet to generate a QR.",
      });
      return;
    }
    const url = claimLinkFor(ev);
    setQrTitle(`${ev.emoji || "🎓"} ${ev.name} — Check-in`);
    setQrUrl(url);
    setQrOpen(true);
  }

  const canCreateOrganizer = useMemo(() => {
    return !!wallet.publicKey && orgName.trim().length >= 2 && !busyOrg;
  }, [wallet.publicKey, orgName, busyOrg]);

  const canCreateEvent = useMemo(() => {
    if (!wallet.publicKey) return false;
    if (!savedOrgPda) return false;

    const startTs = toUnixSeconds(startLocal);
    const endTs = toUnixSeconds(endLocal);

    return (
      !busyEvent &&
      eventName.trim().length >= 2 &&
      claimCode.trim().length >= 4 &&
      Number.isFinite(startTs) &&
      Number.isFinite(endTs) &&
      endTs > startTs
    );
  }, [
    wallet.publicKey,
    savedOrgPda,
    busyEvent,
    eventName,
    claimCode,
    startLocal,
    endLocal,
  ]);

  async function onCreateOrganizer() {
    if (!wallet.publicKey) {
      push({
        type: "error",
        title: "Connect wallet",
        description: "Please connect a wallet to continue.",
      });
      return;
    }

    setBusyOrg(true);
    try {
      const program = getProgram(connection, wallet);
      const [orgPda] = await organizerPda(wallet.publicKey);

      const existing = await connection.getAccountInfo(orgPda);
      if (existing) {
        window.localStorage.setItem(LS_ORG_PDA, orgPda.toBase58());
        setSavedOrgPda(orgPda.toBase58());
        push({
          type: "info",
          title: "Organizer already exists",
          description: `Using organizer PDA: ${shortPk(orgPda.toBase58())}`,
          actionLabel: "View",
          onAction: () =>
            window.open(explorerAddressUrl(orgPda.toBase58()), "_blank"),
        });
        return;
      }

      const sig = await program.methods
        .createOrganizer(orgName.trim())
        .accountsStrict({
          authority: wallet.publicKey,
          organizer: orgPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await waitForSignature(connection, sig, 60000);

      window.localStorage.setItem(LS_ORG_PDA, orgPda.toBase58());
      setSavedOrgPda(orgPda.toBase58());

      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1200);

      push({
        type: "success",
        title: "Organizer created 🎉",
        description: `Tx: ${sig.slice(0, 8)}…${sig.slice(-6)}`,
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

        const msg = e.message || "SendTransactionError";

        if (
          msg.includes("Transaction was not confirmed in 30.00 seconds") ||
          msg.includes("Confirmation delayed") ||
          msg.includes("Check signature in Explorer")
        ) {
          push({
            type: "info",
            title: "Confirmation delayed",
            description:
              "Your organizer may still be created on devnet. Wait a little, then check again before retrying.",
            actionLabel: logs?.length ? "Show logs" : undefined,
            onAction: logs?.length
              ? () => console.log("Transaction logs:", logs)
              : undefined,
          });
        } else {
          push({
            type: "error",
            title: "Create organizer failed",
            description: msg,
            actionLabel: logs?.length ? "Show logs" : undefined,
            onAction: logs?.length
              ? () => console.log("Transaction logs:", logs)
              : undefined,
          });
        }

        console.error(e, logs);
        return;
      }

      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Transaction failed";

      push({
        type: msg.includes("Confirmation delayed") ? "info" : "error",
        title: msg.includes("Confirmation delayed")
          ? "Confirmation delayed"
          : "Create organizer failed",
        description: msg.includes("Confirmation delayed")
          ? "Your organizer may still be created on devnet. Wait a little, then check again before retrying."
          : msg,
      });

      console.error(e);
    } finally {
      setBusyOrg(false);
    }
  }

  async function onCreateEvent() {
    if (!wallet.publicKey) {
      push({
        type: "error",
        title: "Connect wallet",
        description: "Please connect a wallet to continue.",
      });
      return;
    }

    if (!savedOrgPda) {
      push({
        type: "error",
        title: "Create organizer first",
        description: "Organizer PDA is required.",
      });
      return;
    }

    setBusyEvent(true);

    try {
      const program = getProgram(connection, wallet);
      const organizer = new PublicKey(savedOrgPda);

      const eventId = Keypair.generate().publicKey;
      const [event] = await eventPda(organizer, eventId);

      const codeSeed = Keypair.generate().publicKey;
      const [actionType] = await actionTypePda(organizer, codeSeed);
      const actionTypeCode = makeActionCode(eventName.trim());

      const startTs = new BN(toUnixSeconds(startLocal));
      const endTs = new BN(toUnixSeconds(endLocal));

      const actionTypeSig = await program.methods
        .createActionType(
          actionTypeCode,
          `${eventName.trim()} Attendance`,
          eventUri.trim(),
          false
        )
        .accountsStrict({
          authority: wallet.publicKey,
          organizer,
          actionType,
          codeSeed,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await waitForSignature(connection, actionTypeSig, 60000);

      const eventSig = await program.methods
        .createEvent(
          eventName.trim(),
          eventUri.trim(),
          startTs,
          endTs,
          claimCode.trim()
        )
        .accountsStrict({
          authority: wallet.publicKey,
          organizer,
          event,
          eventId,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await waitForSignature(connection, eventSig, 60000);

      const stored: StoredEvent = {
        name: eventName.trim(),
        eventPda: event.toBase58(),
        eventId: eventId.toBase58(),
        actionTypePda: actionType.toBase58(),
        actionTypeCode,
        startTs: startTs.toNumber(),
        endTs: endTs.toNumber(),
        claimCode: claimCode.trim(),
        emoji: eventEmoji.trim() ? eventEmoji.trim() : "🎓",
        cover: eventCover.trim() ? eventCover.trim() : undefined,
      };

      const nextEvents = [stored, ...events].slice(0, 24);
      saveEvents(nextEvents);
      saveEventActionType(event.toBase58(), actionType.toBase58());

      openSharePanelFor(stored);

      const url = claimLinkFor(stored);
      setQrTitle(`${stored.emoji || "🎓"} ${stored.name} — Check-in`);
      setQrUrl(url);
      setQrOpen(true);

      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 1200);

      push({
        type: "success",
        title: "Event posted ✨",
        description: `Event: ${shortPk(event.toBase58())}`,
        actionLabel: "View tx",
        onAction: () => window.open(explorerTxUrl(eventSig), "_blank"),
      });

      console.log("createActionType tx:", actionTypeSig);
      console.log("createEvent tx:", eventSig);
      console.log("participant link:", url);

      setEventName("");
      setEventUri("");
      setClaimCode("");
      setEventEmoji("🎓");
      setEventCover("");
    } catch (e: unknown) {
      if (e instanceof SendTransactionError) {
        let logs: string[] | undefined;
        try {
          logs = await e.getLogs(connection);
        } catch {
          // ignore
        }

        const msg = e.message || "SendTransactionError";

        if (
          msg.includes("Transaction was not confirmed in 30.00 seconds") ||
          msg.includes("Confirmation delayed") ||
          msg.includes("Check signature in Explorer")
        ) {
          push({
            type: "info",
            title: "Confirmation delayed",
            description:
              "Your event may still succeed on devnet. Wait a little, then check Recent posts or Explorer before retrying.",
            actionLabel: logs?.length ? "Show logs" : undefined,
            onAction: logs?.length
              ? () => console.log("Transaction logs:", logs)
              : undefined,
          });
        } else {
          push({
            type: "error",
            title: "Create event failed",
            description: msg,
            actionLabel: logs?.length ? "Show logs" : undefined,
            onAction: logs?.length
              ? () => console.log("Transaction logs:", logs)
              : undefined,
          });
        }

        console.error(e, logs);
        return;
      }

      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "Transaction failed";

      push({
        type: msg.includes("Confirmation delayed") ? "info" : "error",
        title: msg.includes("Confirmation delayed")
          ? "Confirmation delayed"
          : "Create event failed",
        description: msg.includes("Confirmation delayed")
          ? "Your event may still succeed on devnet. Wait a little, then check Recent posts or Explorer before retrying."
          : msg,
      });

      console.error(e);
    } finally {
      setBusyEvent(false);
    }
  }

  const previewCover = eventCover.trim();

  return (
    <div className="space-y-5">
      <Celebration fire={celebrate} />
      <QrModal
        open={qrOpen}
        title={qrTitle}
        url={qrUrl}
        onClose={() => setQrOpen(false)}
      />

      <div className="card-social overflow-hidden">
        <div
          className="p-6 sm:p-8"
          style={{
            background: previewCover
              ? `linear-gradient(180deg, rgba(0,0,0,0.42), rgba(0,0,0,0.58)), url(${previewCover}) center/cover`
              : "linear-gradient(135deg, rgba(47,107,255,0.28), rgba(124,92,255,0.28))",
          }}
        >
          <div className={previewCover ? "rounded-[28px] bg-black/25 p-6 sm:p-7" : ""}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="pill">
                  <span>Organizer</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.7)]" />
                  <span className="opacity-80">Event post</span>
                </div>

                <h1 className="h1 mt-4 text-white sm:text-[color:var(--text-primary)]">
                  {eventEmoji || "🎓"}{" "}
                  {eventName.trim() ? eventName.trim() : "Create an event post"}
                </h1>

                <p className="p mt-3 max-w-2xl text-white/90 sm:text-[color:var(--text-secondary)]">
                  Create a check-in post, share the link or QR, and let attendees tap in like a story.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {statusChip("📌", `${events.length} posts`)}
                  {statusChip("🔗", shareUrl ? "link ready" : "ready to share")}
                </div>
              </div>

              {wallet.publicKey ? (
                <div className="hidden sm:flex pill">
                  <span className="opacity-80">Connected</span>
                  <span className="font-mono">
                    {shortPk(wallet.publicKey.toBase58())}
                  </span>
                </div>
              ) : (
                <div className="hidden sm:flex pill opacity-80">
                  Connect wallet to post
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                className="btn-primary shine w-full"
                onClick={onCreateEvent}
                disabled={!canCreateEvent}
                type="button"
              >
                {busyEvent ? "Posting…" : "✨ Post event"}
              </button>

              <button
                className="btn-secondary w-full"
                onClick={() => {
                  if (events[0]) openSharePanelFor(events[0]);
                }}
                disabled={!events[0]}
                type="button"
              >
                Open latest share
              </button>
            </div>

            <div className="mt-3 text-xs text-white/80 sm:text-[color:var(--text-secondary)]">
              Create once, then share everywhere: WhatsApp, X, Telegram, QR in-room.
            </div>
          </div>
        </div>
      </div>

      {!savedOrgPda ? (
        <div className="card-social p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Create your organizer profile</div>
              <div className="mt-1 text-sm opacity-80">
                This is your creator identity for posting events on-chain.
              </div>
            </div>
            <div className="pill">👤</div>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <label className="label">Organizer name</label>
              <input
                className="input mt-2"
                placeholder="e.g. Solana Tokyo Builders"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>

            <button
              className="btn-primary w-full shine"
              onClick={onCreateOrganizer}
              disabled={!canCreateOrganizer}
              type="button"
            >
              {busyOrg ? "Creating…" : "Create organizer"}
            </button>

            {!wallet.publicKey ? (
              <div className="text-xs opacity-70">
                Connect your wallet first.
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="card-social p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Organizer ready</div>
              <div className="mt-1 text-sm opacity-80">
                Your organizer profile is active and can post events.
              </div>
            </div>
            <div className="pill">✅</div>
          </div>

          <div className="mt-4 rounded-3xl border border-white/10 bg-white/60 p-4 dark:bg-white/5">
            <div className="text-xs opacity-70">Organizer PDA</div>
            <div className="mt-2 font-mono text-xs break-all opacity-85">
              {savedOrgPda}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="btn-secondary"
                onClick={async () => {
                  await copyToClipboard(savedOrgPda);
                  push({
                    type: "success",
                    title: "Copied",
                    description: "Organizer PDA copied.",
                  });
                }}
                type="button"
              >
                Copy
              </button>
              <button
                className="btn-secondary"
                onClick={() =>
                  window.open(explorerAddressUrl(savedOrgPda), "_blank")
                }
                type="button"
              >
                Explorer
              </button>
            </div>
          </div>
        </div>
      )}

      {shareUrl ? (
        <div className="card-social p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="pill">📣 Share this check-in</div>
              <div className="mt-3 text-sm font-semibold">
                Your post is ready to go live
              </div>
              <div className="mt-1 text-sm opacity-80">
                Share the link, copy it, or show the QR in person.
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="btn-secondary"
                onClick={() => setQrOpen(true)}
                type="button"
              >
                🔳 QR
              </button>
              <button
                className="btn-ghost"
                onClick={() => setShareUrl("")}
                type="button"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="mt-4">
            <ShareRow
              title={shareTitle || "Open Rails check-in"}
              text={shareText || "Tap to check in"}
              url={shareUrl}
              onCopied={() =>
                push({
                  type: "success",
                  title: "Copied",
                  description: "Link copied to clipboard.",
                })
              }
            />
          </div>

          <details className="mt-4 rounded-2xl border border-white/10 bg-white/60 p-3 dark:bg-white/5">
            <summary className="cursor-pointer text-xs font-semibold opacity-80">
              Show full link
            </summary>
            <div className="mt-3 text-xs break-all opacity-80">{shareUrl}</div>
          </details>
        </div>
      ) : null}

      <div className="card-social p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Compose your next event</div>
            <div className="mt-1 text-sm opacity-80">
              Think of this like writing a social post with a check-in attached.
            </div>
          </div>
          <div className="pill">📝</div>
        </div>

        <div
          className="mt-5 rounded-3xl overflow-hidden border border-white/10"
          style={{
            background: previewCover
              ? `linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.55)), url(${previewCover}) center/cover`
              : "linear-gradient(135deg, rgba(47,107,255,0.35), rgba(124,92,255,0.35))",
          }}
        >
          <div className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-2xl bg-white/70 dark:bg-white/10 border border-white/10 flex items-center justify-center">
                  <span className="text-xl">{eventEmoji || "🎓"}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">
                    {eventName.trim() ? eventName.trim() : "Your event title…"}
                  </div>
                  <div className="text-xs text-white/80">
                    {mounted ? previewTime : "\u00A0"}
                  </div>
                </div>
              </div>

              <div className="pill text-white bg-white/10 border-white/10">
                🔒 On-chain
              </div>
            </div>

            <div className="mt-4 text-sm text-white/90">
              Share this post link and attendees can tap straight into check-in.
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Event title</label>
              <input
                className="input mt-2"
                placeholder="e.g. Veyra 2026 Seminar"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Emoji</label>
              <input
                className="input mt-2"
                placeholder="🎓"
                value={eventEmoji}
                onChange={(e) => setEventEmoji(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">Cover image URL (optional)</label>
            <input
              className="input mt-2"
              placeholder="https://... (banner image)"
              value={eventCover}
              onChange={(e) => setEventCover(e.target.value)}
            />
            <div className="mt-2 text-xs opacity-70">
              Optional. If blank, we use a premium gradient.
            </div>
          </div>

          <div>
            <label className="label">Claim code</label>
            <input
              className="input mt-2"
              placeholder="Auto-generated (editable)"
              value={claimCode}
              onChange={(e) => setClaimCode(e.target.value)}
            />
            <div className="mt-2 text-xs opacity-70">
              Attendees don’t type this manually when they use your link or QR.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Start (local time)</label>
              <input
                className="input mt-2 w-full min-w-0 appearance-none"
                type="datetime-local"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
              />
            </div>
            <div>
              <label className="label">End (local time)</label>
              <input
                className="input mt-2 w-full min-w-0 appearance-none"
                type="datetime-local"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
              />
            </div>
          </div>

          {toUnixSeconds(endLocal) <= toUnixSeconds(startLocal) ? (
            <div className="text-xs text-rose-500">
              End time must be after start time.
            </div>
          ) : null}

          <details className="rounded-3xl border border-white/10 bg-white/50 p-4 dark:bg-white/5">
            <summary className="cursor-pointer text-sm font-semibold">
              Advanced post details
            </summary>

            <div className="mt-4">
              <label className="label">
                Event metadata URI (optional, on-chain)
              </label>
              <input
                className="input mt-2"
                placeholder="https://... (optional)"
                value={eventUri}
                onChange={(e) => setEventUri(e.target.value)}
              />
              <div className="mt-2 text-xs opacity-70">
                Optional public JSON URL (IPFS/Arweave/GitHub raw). Safe to leave blank.
              </div>
            </div>
          </details>
        </div>
      </div>

      <details className="card-social p-6" open={events.length > 0}>
        <summary className="cursor-pointer">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="h2">Recent event posts</h2>
              <p className="p mt-2">
                Your posting feed. Reopen any event and share it again instantly.
              </p>
            </div>
            <div className="pill">📌 {events.length}</div>
          </div>
        </summary>

        {events.length === 0 ? (
          <div className="mt-4 text-sm opacity-70">No events created yet.</div>
        ) : (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            {events.slice(0, 8).map((ev) => {
              const cover = ev.cover?.trim();
              const emoji = ev.emoji || "🎓";
              const url = wallet.publicKey ? claimLinkFor(ev) : "";

              return (
                <div
                  key={ev.eventPda}
                  className="rounded-3xl border border-white/10 overflow-hidden bg-white/60 dark:bg-white/5"
                >
                  <div
                    className="h-28 w-full"
                    style={{
                      background: cover
                        ? `linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.55)), url(${cover}) center/cover`
                        : "linear-gradient(135deg, rgba(47,107,255,0.35), rgba(124,92,255,0.35))",
                    }}
                  />

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">
                          {emoji} {ev.name}
                        </div>
                        <div className="mt-1 text-xs opacity-80">
                          Code: <span className="font-mono">{ev.claimCode}</span>
                        </div>
                        <div className="mt-2 text-xs opacity-70">
                          Event {shortPk(ev.eventPda)}
                        </div>
                      </div>

                      <button
                        className="btn-secondary px-3 py-2"
                        onClick={() =>
                          window.open(explorerAddressUrl(ev.eventPda), "_blank")
                        }
                        type="button"
                      >
                        🔎
                      </button>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        className="btn-secondary"
                        onClick={async () => {
                          openSharePanelFor(ev);
                          await onCopyLink(ev);
                        }}
                        type="button"
                      >
                        📋 Copy
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          openSharePanelFor(ev);
                          onShowQr(ev);
                        }}
                        type="button"
                      >
                        🔳 QR
                      </button>
                      <button
                        className="btn-primary shine"
                        onClick={() => {
                          if (!wallet.publicKey) {
                            push({
                              type: "error",
                              title: "Connect wallet",
                              description:
                                "Connect your organizer wallet to share.",
                            });
                            return;
                          }
                          openSharePanelFor(ev);
                          setQrTitle(`${emoji} ${ev.name} — Check-in`);
                          setQrUrl(url);
                          setQrOpen(true);
                        }}
                        type="button"
                      >
                        🚀 Share
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </details>

      <div className="card-social p-6 opacity-90">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="h2">Next: Action posts (PRA)</h2>
            <p className="p mt-2">
              Real-world action proofs will feel like posting a story with evidence and place.
            </p>
          </div>
          <div className="pill">🧩</div>
        </div>

        <div className="mt-4">
          <button className="btn-secondary w-full" disabled type="button">
            Coming next
          </button>
        </div>
      </div>
    </div>
  );
}