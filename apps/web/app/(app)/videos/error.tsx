"use client";
export default function VideoError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="m-8 rounded-xl border border-line bg-panel p-8">
      <h1 className="text-xl font-semibold">Couldn't load your videos</h1>
      <p className="my-3 text-sm text-ink-2">Check your connection and try again.</p>
      <button type="button" onClick={reset} className="rounded-lg bg-lime px-4 py-2 text-sm font-medium">
        Try again
      </button>
    </div>
  );
}
