"use client";

import React, { useEffect, useMemo, useState } from "react";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/explorer";
import { ShareRow } from "@/components/share-row";

type StoredClaim = {
  claimPda: string;
  organizerAuthority: string;
  eventPda?: string;
  claimCode?: string;
  tx?: string;
  occurredTs: number;
  title?: string;
  emoji?: string;
  cover?: string;
};

const LS_CLAIMS = "openrails.claims";

function shortPk(pk: string) {
  return `${pk.slice(0, 6)}…${pk.slice(-6)}`;
}

export default function ExplorePage() {
  const [items, setItems] = useState<StoredClaim[]>([]);
  const [mounted, setMounted] = useState(false);
  const [origin, setOrigin] = useState("");

  // Cache formatted timestamps to avoid per-render locale differences
  const [timeLabelByClaim, setTimeLabelByClaim] = useState<Record<string, string>>({});

  useEffect(() => {
    setMounted(true);
    setOrigin(window.location.origin);

    const raw = window.localStorage.getItem(LS_CLAIMS);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as StoredClaim[];
      const next = parsed || [];
      setItems(next);

      // Build time labels on client only (prevents hydration mismatch)
      const map: Record<string, string> = {};
      for (const c of next) {
        const ts = (c.occurredTs || 0) * 1000;
        map[c.claimPda] = ts > 0 ? new Date(ts).toLocaleString() : "—";
      }
      setTimeLabelByClaim(map);
    } catch {
      // ignore
    }
  }, []);

  const proofs = useMemo(() => items.slice(0, 20), [items]);

  return (
    <div className="space-y-6">
      <div className="card-social p-6 sm:p-8">
        <div className="pill">Explore</div>
        <h1 className="h1 mt-4">Verified proofs (soon)</h1>
        <p className="p mt-2">
          This feed will become the social layer — shareable proof cards that feel like posts.
          For now it shows your recent check-ins saved on this device.
        </p>
      </div>

      {mounted && proofs.length === 0 ? (
        <div className="card-social p-6">
          <div className="text-sm font-semibold">No proofs yet</div>
          <div className="mt-2 text-sm opacity-80">
            Create an event → share link → check in from another wallet → approve (validator) → it appears here.
          </div>
        </div>
      ) : null}

      {mounted && proofs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {proofs.map((p) => {
            const title = p.title || "Check-in proof";
            const emoji = p.emoji || "✅";
            const cover = p.cover?.trim();

            // Client-only computed origin (no typeof window inside render)
            const proofUrl = origin ? `${origin}/explore?proof=${p.claimPda}` : "";

            const timeLabel = timeLabelByClaim[p.claimPda] || "—";

            return (
              <div key={p.claimPda} className="card-social overflow-hidden">
                {/* Cover */}
                <div
                  className="h-32 w-full"
                  style={{
                    background: cover
                      ? `linear-gradient(180deg, rgba(0,0,0,0.45), rgba(0,0,0,0.55)), url(${cover}) center/cover`
                      : "linear-gradient(135deg, rgba(47,107,255,0.55), rgba(124,92,255,0.55))",
                  }}
                />

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">
                        {emoji} {title}
                      </div>
                      <div className="mt-1 text-xs opacity-80">
                        Proof: <span className="font-mono">{shortPk(p.claimPda)}</span>
                      </div>
                    </div>

                    <a
                      className="btn-secondary px-3 py-2"
                      href={explorerAddressUrl(p.claimPda)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      🔎
                    </a>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/60 dark:bg-white/5 p-3">
                    <div className="text-xs opacity-80">Timestamp: {timeLabel}</div>
                    {p.tx ? (
                      <div className="mt-2">
                        <a
                          className="text-xs underline opacity-90"
                          href={explorerTxUrl(p.tx)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View transaction
                        </a>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <ShareRow
                      title={`Open Rails proof — ${title}`}
                      text={`${emoji} ${title} — verified proof`}
                      url={proofUrl || explorerAddressUrl(p.claimPda)}
                      onCopied={() => {
                        // optional toast hook if you want it later
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* During first SSR render, show nothing here to avoid mismatch */}
      {!mounted ? (
        <div className="card-social p-6">
          <div className="text-sm opacity-70">Loading proofs…</div>
        </div>
      ) : null}
    </div>
  );
}