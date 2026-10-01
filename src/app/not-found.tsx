import Link from "next/link";

export default function NotFound() {
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center" }}><section><h1>Página no encontrada</h1><p>Este espacio no existe o fue movido.</p><Link href="/">Volver al chat</Link></section></main>;
}
