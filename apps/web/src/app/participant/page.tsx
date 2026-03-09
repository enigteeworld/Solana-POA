import React, { Suspense } from "react";
import ParticipantClient from "./ParticipantClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="container-page py-10 text-sm opacity-70">Loading…</div>
      }
    >
      <ParticipantClient />
    </Suspense>
  );
}