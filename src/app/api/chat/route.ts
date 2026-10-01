import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!text || text.length > 20_000) {
    return NextResponse.json({ error: { code: "INVALID_MESSAGE", message: "Escribe un mensaje válido." } }, { status: 400 });
  }

  // Punto de integración: sustituir por el proveedor configurado en lib/ai/provider.ts.
  return NextResponse.json({
    message: `He recibido tu idea sobre “${text.slice(0, 80)}${text.length > 80 ? "…" : ""}”.\n\nLa integración con IA se conectará aquí cuando configures el proveedor y su clave en .env.local.`,
  });
}
