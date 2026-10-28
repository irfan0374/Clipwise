"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Shown only when the root layout itself crashes. It replaces the whole document, so the app's styles and fonts
// aren't loaded: plain inline styles in the Clipwise colours.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error && typeof error === "object" && "digest" in error ? String(error.digest) : null;
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#F6F7F2",
          color: "#0F0F0F",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          padding: 16,
        }}
      >
        <title>Something went wrong · Clipwise</title>
        <div
          role="alert"
          style={{ maxWidth: 440, background: "#fff", border: "1px solid #E7E7E0", borderRadius: 12, padding: 32 }}
        >
          <h1 style={{ fontSize: 22, margin: 0 }}>Clipwise couldn't load</h1>
          <p style={{ color: "#52525B", fontSize: 14, lineHeight: 1.5 }}>
            Something went wrong on our side. Try again in a moment.
          </p>
          {digest && <p style={{ color: "#71717A", fontSize: 12 }}>Error code: {digest}</p>}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 8,
              background: "#C6F432",
              border: 0,
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
