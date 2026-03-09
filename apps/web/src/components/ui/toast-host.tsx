"use client";

import React from "react";
import { useToast } from "./toast";

function baseStyle(type: "success" | "error" | "info") {
  switch (type) {
    case "success":
      return [
        "border-emerald-400/30",
        "bg-emerald-50 text-emerald-950",
        "dark:bg-slate-900 dark:text-white",
        "dark:border-emerald-400/35",
        "dark:shadow-[0_0_0_1px_rgba(16,185,129,0.14),0_18px_44px_rgba(0,0,0,0.55)]",
      ].join(" ");
    case "error":
      return [
        "border-rose-400/30",
        "bg-rose-50 text-rose-950",
        "dark:bg-slate-900 dark:text-white",
        "dark:border-rose-400/35",
        "dark:shadow-[0_0_0_1px_rgba(244,63,94,0.14),0_18px_44px_rgba(0,0,0,0.55)]",
      ].join(" ");
    default:
      return [
        "border-slate-300/60",
        "bg-white text-slate-900",
        "dark:bg-slate-900 dark:text-white",
        "dark:border-white/12",
        "dark:shadow-[0_18px_44px_rgba(0,0,0,0.55)]",
      ].join(" ");
  }
}

function accentBar(type: "success" | "error" | "info") {
  switch (type) {
    case "success":
      return "bg-emerald-400";
    case "error":
      return "bg-rose-400";
    default:
      return "bg-sky-400";
  }
}

export function ToastHost() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed right-4 top-20 z-[100] w-[92vw] max-w-sm space-y-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            "relative overflow-hidden rounded-2xl border p-4 backdrop-blur-xl",
            "shadow-[0_1px_0_rgba(15,23,42,0.04),0_16px_44px_rgba(15,23,42,0.14)]",
            baseStyle(t.type),
          ].join(" ")}
          role="status"
        >
          <div className={`absolute inset-y-0 left-0 w-1.5 ${accentBar(t.type)}`} />

          <div className="flex items-start justify-between gap-3 pl-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight text-slate-950 dark:text-white">
                {t.title}
              </div>

              {t.description ? (
                <div className="mt-1 text-sm text-slate-700 dark:text-white/85">
                  {t.description}
                </div>
              ) : null}

              {t.actionLabel && t.onAction ? (
                <button
                  className="mt-3 inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                  onClick={t.onAction}
                  type="button"
                >
                  {t.actionLabel}
                </button>
              ) : null}
            </div>

            <button
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs text-slate-600 transition hover:bg-black/5 hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={() => dismiss(t.id)}
              type="button"
              aria-label="Dismiss toast"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}