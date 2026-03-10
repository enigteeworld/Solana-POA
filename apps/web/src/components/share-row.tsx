
"use client";

import React from "react";
import {
  copyToClipboard,
  nativeShare,
  whatsappShareUrl,
  xShareUrl,
} from "@/lib/share";

function WhatsAppIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="currentColor"
    >
      <path d="M20.52 3.48A11.86 11.86 0 0 0 12.07 0C5.55 0 .24 5.3.24 11.82c0 2.08.54 4.12 1.57 5.93L0 24l6.45-1.69a11.8 11.8 0 0 0 5.62 1.43h.01c6.52 0 11.83-5.3 11.83-11.82 0-3.16-1.23-6.12-3.39-8.44ZM12.08 21.7h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.83 1 1.02-3.74-.24-.38a9.78 9.78 0 0 1-1.5-5.18c0-5.42 4.41-9.83 9.84-9.83 2.63 0 5.1 1.02 6.95 2.88a9.75 9.75 0 0 1 2.88 6.95c0 5.42-4.42 9.83-9.85 9.83Zm5.39-7.33c-.29-.14-1.7-.84-1.96-.93-.26-.1-.45-.14-.64.14-.19.29-.74.93-.91 1.12-.17.19-.34.21-.63.07-.29-.14-1.24-.46-2.36-1.46-.87-.78-1.46-1.74-1.63-2.03-.17-.29-.02-.45.12-.59.12-.12.29-.33.43-.5.14-.17.19-.29.29-.48.09-.19.05-.36-.02-.5-.07-.14-.64-1.54-.88-2.11-.23-.56-.47-.49-.64-.5h-.55c-.19 0-.5.07-.76.36-.26.29-1 1-.99 2.43 0 1.43 1.03 2.81 1.17 3 .14.19 2.02 3.09 4.89 4.33.68.29 1.21.47 1.63.6.68.22 1.29.19 1.78.11.54-.08 1.7-.69 1.94-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.33Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="currentColor"
    >
      <path d="M18.9 2H21l-4.59 5.25L21.82 22h-4.24l-3.32-4.35L10.46 22H8.35l4.9-5.6L2.82 2h4.35l3 3.93L13.6 2h2.1Zm-1.49 18h1.17L7.19 3.9H5.93L17.41 20Z" />
    </svg>
  );
}

type ShareRowProps = {
  title: string;
  text: string;
  url: string;
  onCopied?: () => void;
};

export function ShareRow({
  title,
  text,
  url,
  onCopied,
}: ShareRowProps) {
  async function onCopy() {
    await copyToClipboard(url);
    onCopied?.();
  }

  async function onNative() {
    await nativeShare({ title, text, url });
  }

  const buttonBase =
    "inline-flex min-h-[56px] items-center justify-center gap-2 text-center leading-none";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <button
        className={`btn-primary shine ${buttonBase}`}
        onClick={onNative}
        type="button"
      >
        <span className="text-base leading-none">📱</span>
        <span className="leading-none">Share</span>
      </button>

      <button
        className={`btn-secondary ${buttonBase}`}
        onClick={onCopy}
        type="button"
      >
        <span className="text-base leading-none">📋</span>
        <span className="leading-none">Copy link</span>
      </button>

      <a
        className={`btn-secondary ${buttonBase}`}
        href={whatsappShareUrl(text, url)}
        target="_blank"
        rel="noreferrer"
      >
        <span className="text-green-500">
          <WhatsAppIcon />
        </span>
        <span className="leading-none">WhatsApp</span>
      </a>

      <a
        className={`btn-secondary ${buttonBase}`}
        href={xShareUrl(text, url)}
        target="_blank"
        rel="noreferrer"
      >
        <XIcon />
        <span className="leading-none">X</span>
      </a>
    </div>
  );
}