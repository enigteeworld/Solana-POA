"use client";

import React from "react";
import { copyToClipboard, nativeShare, whatsappShareUrl, xShareUrl } from "@/lib/share";

export function ShareRow({
  title,
  text,
  url,
  onCopied,
}: {
  title: string;
  text: string;
  url: string;
  onCopied?: () => void;
}) {
  async function onCopy() {
    await copyToClipboard(url);
    onCopied?.();
  }

  async function onNative() {
    await nativeShare({ title, text, url });
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <button className="btn-primary shine" onClick={onNative} type="button">
        📲 Share
      </button>

      <button className="btn-secondary" onClick={onCopy} type="button">
        📋 Copy link
      </button>

      <a className="btn-secondary" href={whatsappShareUrl(text, url)} target="_blank" rel="noreferrer">
        🟢 WhatsApp
      </a>

      <a className="btn-secondary" href={xShareUrl(text, url)} target="_blank" rel="noreferrer">
        🐦 X
      </a>
    </div>
  );
}