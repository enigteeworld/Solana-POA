export async function copyToClipboard(text: string) {
  if (typeof window === "undefined") return false;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ignore
  }

  // Fallback
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}

export async function nativeShare(payload: { title: string; text?: string; url: string }) {
  if (typeof window === "undefined") return false;
  const nav = navigator as unknown as { share?: (p: any) => Promise<void> };

  if (!nav.share) return false;

  try {
    await nav.share(payload);
    return true;
  } catch {
    return false;
  }
}

export function whatsappShareUrl(text: string, url: string) {
  const msg = encodeURIComponent(`${text}\n${url}`);
  return `https://wa.me/?text=${msg}`;
}

export function xShareUrl(text: string, url: string) {
  const msg = encodeURIComponent(text);
  const u = encodeURIComponent(url);
  return `https://twitter.com/intent/tweet?text=${msg}&url=${u}`;
}