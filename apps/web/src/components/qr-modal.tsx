"use client";

import React, { useMemo, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { copyToClipboard, nativeShare, whatsappShareUrl, xShareUrl } from "@/lib/share";

export function QrModal({
  open,
  title,
  url,
  onClose,
}: {
  open: boolean;
  title: string;
  url: string;
  onClose: () => void;
}) {
  const qrWrapRef = useRef<HTMLDivElement | null>(null);

  const shareText = useMemo(() => `${title} — claim link`, [title]);

  if (!open) return null;

  async function onCopy() {
    await copyToClipboard(url);
  }

  async function onNativeShare() {
    await nativeShare({ title, text: shareText, url });
  }

  function onDownloadQr() {
    const wrap = qrWrapRef.current;
    const canvas = wrap?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;

    const pngUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = "open-rails-qr.png";
    a.click();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-md card-social p-5 sm:p-6 fade-in">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="mt-1 text-xs opacity-80">Scan to open claim page</div>
          </div>

          <button className="btn-secondary px-3 py-2" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        <div
          ref={qrWrapRef}
          className="mt-5 flex items-center justify-center rounded-2xl border border-white/10 bg-white/70 dark:bg-white/5 p-4"
        >
          <QRCodeCanvas value={url} size={232} includeMargin />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/60 dark:bg-white/5 p-3">
          <div className="text-xs break-all opacity-90">{url}</div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button className="btn-primary" onClick={onNativeShare} type="button">
            📲 Share
          </button>
          <button className="btn-secondary" onClick={onCopy} type="button">
            📋 Copy
          </button>

          <a className="btn-secondary" href={whatsappShareUrl(shareText, url)} target="_blank" rel="noreferrer">
            🟢 WhatsApp
          </a>
          <a className="btn-secondary" href={xShareUrl(shareText, url)} target="_blank" rel="noreferrer">
            🐦 X
          </a>
        </div>

        <button className="btn-ghost w-full mt-3" onClick={onDownloadQr} type="button">
          ⬇️ Download QR image (for Instagram story)
        </button>

        <div className="mt-2 text-xs opacity-70">
          Tip: Instagram doesn’t allow clickable links in captions — post the QR or put the link in bio/story.
        </div>
      </div>
    </div>
  );
}