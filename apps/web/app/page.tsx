import { Format, Voices } from "@clipwise/shared";

// Placeholder until the app shell and homepage (Features 3 and 4).
export default function Home() {
  return (
    <main className="placeholder">
      <h1>Clipwise</h1>
      <p>Project setup is running. The real app arrives feature by feature.</p>
      <dl>
        <dt>Formats</dt>
        <dd>{Format.options.join(" · ")}</dd>
        <dt>Voices</dt>
        <dd>{Voices.map((v) => v.name).join(" · ")}</dd>
      </dl>
    </main>
  );
}
