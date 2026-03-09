"use client";

import React from "react";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/explorer";
import { ShareRow } from "@/components/share-row";

function shortPk(pk: string) {
  return `${pk.slice(0, 6)}…${pk.slice(-6)}`;
}

export type ProofCardModel = {
  claimPda: string;
  title?: string;
  emoji?: string;
  cover?: string;
  tx?: string;
  occurredTs?: number;
  verified?: boolean; // UI-only for now
};

export function ProofCard({ proof }: { proof: ProofCardModel }) {
  const emoji = proof.emoji?.trim() || "✅";
  const title = proof.title?.trim() || "Proof";
  const cover = proof.cover?.trim();

  const shareUrl = explorerAddressUrl(proof.claimPda);
  const shareText = `${emoji} ${title} — on-chain proof: ${shortPk(proof.claimPda)}`;

  return (
    <div className="rounded-3xl border border-white/10 overflow-hidden bg-white/60 dark:bg-white/5">
      {/* Cover strip */}
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
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/70 dark:bg-white/10 border border-white/10 flex items-center justify-center">
              <span className="text-2xl">{emoji}</span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold">{title}</div>
                <div className="pill">
                  {proof.verified ? "✅ Verified" : "🕓 Pending"}
                </div>
              </div>

              <div className="mt-1 font-mono text-xs opacity-80 break-all">{proof.claimPda}</div>
            </div>
          </div>

          <button className="btn-secondary px-3 py-2" onClick={() => window.open(shareUrl, "_blank")} type="button">
            Explorer
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => navigator.clipboard.writeText(proof.claimPda)} type="button">
            Copy PDA
          </button>

          {proof.tx ? (
            <button className="btn-secondary" onClick={() => window.open(explorerTxUrl(proof.tx!), "_blank")} type="button">
              Tx
            </button>
          ) : null}
        </div>

        <div className="mt-4">
          <ShareRow
            title={`Open Rails • ${title}`}
            text={shareText}
            url={shareUrl}
            onCopied={() => {}}
          />
        </div>
      </div>
    </div>
  );
}