import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Playlist",
  robots: { index: false, follow: false },
};

export default function PlaylistPage() {
  return (
    <main style={{ padding: "2rem" }}>
      <h1>Playlist Control</h1>

      <p>You currently own this playlist block.</p>

      <button>Add Song</button>
    </main>
  );
}
