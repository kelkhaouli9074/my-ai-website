
const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite"
];

const API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing in Vercel environment variables."
    });
  }

  try {
    const { message, history = [], image } = req.body || {};

    if (!message && !image) {
      return res.status(400).json({ error: "Message is empty." });
    }

    const contents = [];

    // Keep recent conversation history
    if (Array.isArray(history)) {
      history.slice(-12).forEach((item) => {
        if (!item || !item.content) return;

        contents.push({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: String(item.content) }]
        });
      });
    }

    // Current user message
    const parts = [];

    if (message) {
      parts.push({ text: String(message) });
    }

    // Optional image
    if (image && image.data && image.mimeType) {
      parts.push({
        inline_data: {
          mime_type: image.mimeType,
          data: image.data
        }
      });
    }

    contents.push({
      role: "user",
      parts
    });

    let lastError = "";

    // Try primary model, then fallback
    for (const model of MODELS) {
      try {
        const response = await fetch(
          `${API_URL}/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{
                  text: "You are MY AI, a helpful, clear and friendly AI assistant. Answer in the same language as the user."
                }]
              },
              contents,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048
              }
            })
          }
        );

        const data = await response.json();

        if (response.ok) {
          const reply = data.candidates?.[0]?.content?.parts
            ?.map(part => part.text || "")
            .join("")
            .trim();

          if (!reply) {
            lastError = "The model returned an empty response.";
            continue;
          }

          return res.status(200).json({
            reply,
            model
          });
        }

        lastError =
          data.error?.message || `Gemini API error: ${response.status}`;

        // Try fallback only for temporary/server/model availability errors
        const shouldFallback = [
          404, 429, 500, 502, 503, 504
        ].includes(response.status);

        if (!shouldFallback) {
          return res.status(response.status).json({
            error: lastError
          });
        }

      } catch (error) {
        lastError = error.message || "Connection error.";
      }
    }

    return res.status(503).json({
      error: "Both Gemini models are temporarily unavailable. Please try again.",
      details: lastError
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Internal server error."
    });
  }
}
