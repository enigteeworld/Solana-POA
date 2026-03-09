import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="card p-6 sm:p-10">
        <div className="max-w-3xl">
          <div className="badge mb-4">Unified Proof Rails • POA + PRA</div>
          <h1 className="h1">
            One protocol to prove <span className="text-indigo-700">attendance</span> and{" "}
            <span className="text-sky-700">real-world action</span> on Solana.
          </h1>
          <p className="p mt-4">
            Solana Open Rails records: <b>who</b> did something, <b>what</b> they did, <b>when</b> it happened,
            the <b>context</b>, and <b>who verified</b> it — as an on-chain record that can later be represented
            as a badge/NFT.
          </p>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Link className="btn-primary" href="/organizer">
              Organizer Console
            </Link>
            <Link className="btn-secondary" href="/participant">
              Participant Claims
            </Link>
            <Link className="btn-secondary" href="/explore">
              Explore Proofs
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-solid p-6">
          <div className="badge">POA</div>
          <h2 className="h2 mt-3">Proof of Attendance</h2>
          <p className="p mt-2">
            Events with a time window. Attendees claim via QR/code. Organizer verifies via approval rails.
          </p>
        </div>
        <div className="card-solid p-6">
          <div className="badge">PRA</div>
          <h2 className="h2 mt-3">Proof of Real-World Action</h2>
          <p className="p mt-2">
            Action types like CLEANUP_DONE or PLANTED_TREE. Submit evidence hash + location cell + timestamp.
          </p>
        </div>
        <div className="card-solid p-6">
          <div className="badge">Unified</div>
          <h2 className="h2 mt-3">Same rails, same protocol</h2>
          <p className="p mt-2">
            Attendance is just an action type. You get a single proof format that’s easy to index and query.
          </p>
        </div>
      </section>
    </div>
  );
}