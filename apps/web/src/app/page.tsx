import Link from "next/link";

function Pill({
  icon,
  text,
}: {
  icon: string;
  text: string;
}) {
  return (
    <div className="pill">
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function RailCard({
  badge,
  title,
  text,
  icon,
}: {
  badge: string;
  title: string;
  text: string;
  icon: string;
}) {
  return (
    <div className="card-social p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="badge">{badge}</div>
        <div className="text-2xl">{icon}</div>
      </div>

      <h2 className="h2 mt-4">{title}</h2>
      <p className="p mt-3">{text}</p>
    </div>
  );
}

function FlowCard({
  step,
  title,
  text,
}: {
  step: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/60 p-5 dark:bg-white/5">
      <div className="pill">
        <span>{step}</span>
      </div>
      <div className="mt-4 text-base font-semibold">{title}</div>
      <div className="mt-2 text-sm opacity-80">{text}</div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="space-y-6">
      <section className="card-social overflow-hidden">
        <div className="relative p-6 sm:p-10">
          <div className="pointer-events-none absolute inset-0 opacity-90">
            <div className="absolute -top-24 left-[-10%] h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="absolute top-20 right-[-5%] h-72 w-72 rounded-full bg-sky-500/20 blur-3xl" />
            <div className="absolute bottom-[-3rem] left-[25%] h-56 w-56 rounded-full bg-fuchsia-500/15 blur-3xl" />
          </div>

          <div className="relative max-w-4xl">
            <div className="badge mb-4">Open Rails • Social Proof on Solana</div>

            <h1 className="h1 max-w-3xl">
              Turn real-world participation into something people can
              <span className="text-indigo-700 dark:text-indigo-300"> check in</span>,
              <span className="text-sky-700 dark:text-sky-300"> verify</span>, and
              <span className="text-fuchsia-700 dark:text-fuchsia-300"> share</span>.
            </h1>

            <p className="p mt-4 max-w-2xl">
              Open Rails helps events and communities record attendance and real-world activity
              on-chain — then present it like a social proof layer, not a crypto dashboard.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Pill icon="🎟️" text="Attendance check-ins" />
              <Pill icon="🏅" text="Verified badges" />
              <Pill icon="🔗" text="Shareable proof links" />
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link className="btn-primary shine" href="/organizer">
                Create event post
              </Link>
              <Link className="btn-secondary" href="/participant">
                Check in to an event
              </Link>
              <Link className="btn-secondary" href="/validator">
                Review claims
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <RailCard
          badge="POA"
          icon="🎫"
          title="Proof of Attendance"
          text="Create event posts, share a link or QR, let attendees tap in, then approve attendance into a verified badge."
        />

        <RailCard
          badge="PRA"
          icon="🌍"
          title="Proof of Real-World Action"
          text="Use the same rails for actions completed in the real world — from community contributions to environmental impact."
        />

        <RailCard
          badge="Unified"
          icon="⚡"
          title="One social proof layer"
          text="Same protocol, same flow, same verification layer — designed to feel lightweight, social, and easy to use on mobile."
        />
      </section>

      <section className="card-social p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="badge">How it flows</div>
            <h2 className="h2 mt-4">Built to feel like posting, checking in, and sharing</h2>
            <p className="p mt-3">
              Instead of spreadsheets, screenshots, and manual follow-up, the whole flow becomes
              one smooth loop for organizers and participants.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <FlowCard
            step="1"
            title="Organizer posts an event"
            text="Create a polished event post with title, emoji, image, time window, and claim link."
          />
          <FlowCard
            step="2"
            title="Participant checks in"
            text="Open the link, connect wallet, tap once, and get a pending attendance proof."
          />
          <FlowCard
            step="3"
            title="Badge gets unlocked"
            text="After approval, the check-in becomes a verified attendance badge that can be shared."
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card-social p-6">
          <div className="badge">Organizer experience</div>
          <h2 className="h2 mt-4">Feels like creating a post</h2>
          <p className="p mt-3">
            Organizers create a social-style event card, get a shareable link instantly, and reuse
            recent posts whenever they want.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Pill icon="📝" text="Compose event" />
            <Pill icon="🔳" text="Generate QR" />
            <Pill icon="📣" text="Share everywhere" />
          </div>

          <div className="mt-6">
            <Link className="btn-secondary" href="/organizer">
              Open organizer page
            </Link>
          </div>
        </div>

        <div className="card-social p-6">
          <div className="badge">Participant experience</div>
          <h2 className="h2 mt-4">Feels like a story + badge reveal</h2>
          <p className="p mt-3">
            Participants should feel like they are checking into a live moment, then unlocking a
            badge they can proudly share once verified.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Pill icon="✨" text="One-tap check-in" />
            <Pill icon="⏳" text="Pending review" />
            <Pill icon="🏅" text="Verified badge" />
          </div>

          <div className="mt-6">
            <Link className="btn-secondary" href="/participant">
              Open participant page
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}