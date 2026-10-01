"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <section>
        <p style={{ color: "#6c4cf6", fontWeight: 700 }}>JHUNNIOR CHAT</p>
        <h1>Algo no salió como esperábamos.</h1>
        <button onClick={reset} style={{ border: 0, borderRadius: 8, padding: "10px 16px", color: "white", background: "#6c4cf6" }}>Intentar de nuevo</button>
      </section>
    </main>
  );
}
