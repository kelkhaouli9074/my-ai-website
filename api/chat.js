
const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite"
];

const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_INSTRUCTION = `
You are MY AI, a helpful, intelligent and friendly AI assistant.

IDENTITY:
Your name is MY AI.
You are an AI assistant created for the MY AI project.

FOUNDER INFORMATION:
The founder of MY AI is Khalid El Khaouli (خالد الخولي).
He studies at FST Marrakech.
He is the founder and developer of the MY AI project.

FOUNDER'S VISION:
Khalid's goal is to create an integrated AI application
that brings together different artificial intelligence
tools and technologies in one platform.

If someone asks:
- Who is the founder of MY AI?
- Who created MY AI?
- Who owns MY AI?

Answer:
"Khalid El Khaouli (خالد الخولي) is the founder of MY AI."

Only share the founder information written above.
Never invent personal information about him.
Do not reveal private information.

BEHAVIOR:
- Answer in the same language as the user.
- Be clear, helpful and accurate.
- Explain difficult subjects simply.
- Understand and analyze uploaded images.
- Maintain context during conversations.
- Never claim to be Gemini, Qwen or another AI model.
- Your assistant name is always MY AI.
`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing in Vercel."
    });
  }

  try {
    const {
      message,
      history = [],
      image
    } = req.body || {};

    if (!message && !image) {
      return res.status(400).json({
        error: "Message is empty."
      });
    }

    const contents = [];

    // Previous conversation
    if (Array.isArray(history)) {
      history.slice(-12).forEach((item) => {
        if (!item || !item.content) return;

        contents.push({
          role:
            item.role === "assistant"
              ? "model"
              : "user",
          parts: [
            {
              text: String(item.content)
            }
          ]
        });
      });
    }

    // Current message
    const parts = [];

    if (message) {
      parts.push({
        text: String(message)
      });
    }

    // Uploaded image
    if (
      image &&
      image.data &&
      image.mimeType
    ) {
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

    // Try primary and fallback models
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
                parts: [
                  {
                    text: SYSTEM_INSTRUCTION
                  }
                ]
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
          const reply =
            data.candidates?.[0]?.content?.parts
              ?.map(part => part.text || "")
              .join("")
              .trim();

          if (!reply) {
            lastError =
              "The model returned an empty response.";
            continue;
          }

          return res.status(200).json({
            reply,
            model
          });
        }

        lastError =
          data.error?.message ||
          `Gemini API error: ${response.status}`;

        const retryable = [
          404,
          429,
          500,
          502,
          503,
          504
        ].includes(response.status);

        if (!retryable) {
          return res.status(response.status).json({
            error: lastError
          });
        }

      } catch (error) {
        lastError =
          error.message || "Connection error.";
      }
    }

    return res.status(503).json({
      error:
        "Both Gemini models are unavailable. Please try again.",
      details: lastError
    });

  } catch (error) {
    return res.status(500).json({
      error:
        error.message || "Internal server error."
    });
  }
}
