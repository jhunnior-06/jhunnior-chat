import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type GeminiPart = { text?: string; inlineData?: { mimeType: string; data: string } };
type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };

const MAX_FILES = 5;
const MAX_FILE_SIZE = Number(process.env.MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);
const ALLOWED_TYPES = new Set([
  "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/markdown", "text/csv", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain", md: "text/markdown", csv: "text/csv", xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function mimeTypeFor(file: File) {
  if (ALLOWED_TYPES.has(file.type)) return file.type;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension];
}

function requestGemini(apiKey: string, model: string, parts: GeminiPart[]) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({ contents: [{ role: "user", parts }] }),
    signal: AbortSignal.timeout(25_000),
  });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Debes registrarte o iniciar sesion." } }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "No se pudo leer el mensaje." } }, { status: 400 });
  const text = String(formData.get("text") ?? "").trim();
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  if ((!text && !files.length) || text.length > 20_000 || files.length > MAX_FILES) {
    return NextResponse.json({ error: { code: "INVALID_MESSAGE", message: "Envia un mensaje valido y hasta 5 documentos." } }, { status: 400 });
  }

  const parts: GeminiPart[] = [{ text: text || "Analiza los documentos adjuntos." }];
  for (const file of files) {
    const mimeType = mimeTypeFor(file);
    if (!mimeType || file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: { code: "INVALID_FILE", message: `El archivo ${file.name} no es valido o supera el limite de 10 MB.` } }, { status: 400 });
    }
    parts.push({ inlineData: { mimeType, data: Buffer.from(await file.arrayBuffer()).toString("base64") } });
  }

  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!apiKey || !model || !/^[a-zA-Z0-9.-]+$/.test(model)) {
    return NextResponse.json({ error: { code: "MISSING_CONFIG", message: "Configura AI_API_KEY y AI_MODEL en Vercel." } }, { status: 503 });
  }

  try {
    let response = await requestGemini(apiKey, model, parts);
    for (let attempt = 0; attempt < 2 && response.status >= 500; attempt += 1) {
      await delay(500 * (attempt + 1));
      response = await requestGemini(apiKey, model, parts);
    }
    if (!response.ok) {
      const message = response.status === 429 ? "Alcanzaste el limite del chat. Intenta mas tarde." : response.status === 404 ? "El modelo configurado no esta disponible." : response.status === 400 || response.status === 401 || response.status === 403 ? "Revisa la clave, el modelo y los permisos en Google AI Studio." : "Gemini no esta disponible en este momento.";
      return NextResponse.json({ error: { code: "GEMINI_ERROR", message } }, { status: response.status === 429 ? 429 : 502 });
    }
    const data = (await response.json()) as GeminiResponse;
    const message = data.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text ?? "").join("").trim();
    if (!message) return NextResponse.json({ error: { code: "EMPTY_RESPONSE", message: "Gemini no devolvio una respuesta de texto." } }, { status: 502 });
    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({ error: { code: "CONNECTION_ERROR", message: "La conexion con Gemini fallo o tardo demasiado." } }, { status: 504 });
  }
}
