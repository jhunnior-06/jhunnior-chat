import { NextResponse } from "next/server";

export const runtime = "nodejs";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string; thought?: boolean }>;
    };
  }>;
};

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function requestGemini(apiKey: string, model: string, text: string) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text }] }],
    }),
    signal: AbortSignal.timeout(25_000),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  if (!text || text.length > 20_000) {
    return NextResponse.json(
      { error: { code: "INVALID_MESSAGE", message: "Escribe un mensaje válido." } },
      { status: 400 }
    );
  }

  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!apiKey || !model || !/^[a-zA-Z0-9.-]+$/.test(model)) {
    return NextResponse.json(
      {
        error: {
          code: "MISSING_CONFIG",
          message: "Configura AI_API_KEY y AI_MODEL en Vercel.",
        },
      },
      { status: 503 }
    );
  }

  try {
    let response = await requestGemini(apiKey, model, text);

    // Gemini can return a transient 5xx response when capacity is temporarily unavailable.
    for (let attempt = 0; attempt < 2 && response.status >= 500; attempt += 1) {
      await delay(500 * (attempt + 1));
      response = await requestGemini(apiKey, model, text);
    }

    if (!response.ok) {
      const message =
        response.status === 429
          ? "Alcanzaste el límite del chat. Intenta más tarde."
          : response.status === 404
            ? "El modelo configurado no está disponible."
            : response.status === 400 ||
                response.status === 401 ||
                response.status === 403
              ? "Revisa la clave, el modelo y los permisos en Google AI Studio."
              : "Gemini no está disponible en este momento.";

      return NextResponse.json(
        { error: { code: "GEMINI_ERROR", message } },
        { status: response.status === 429 ? 429 : 502 }
      );
    }

    const data = (await response.json()) as GeminiResponse;
    const message = data.candidates?.[0]?.content?.parts
      ?.filter((part) => !part.thought)
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    if (!message) {
      return NextResponse.json(
        {
          error: {
            code: "EMPTY_RESPONSE",
            message: "Gemini no devolvió una respuesta de texto.",
          },
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ message });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "CONNECTION_ERROR",
          message: "La conexión con Gemini falló o tardó demasiado.",
        },
      },
      { status: 504 }
    );
  }
}
