
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing in Vercel"
      });
    }

    const {
      message,
      history = [],
      image = null
    } = req.body || {};

    if (
      !message ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        error: "Message is empty"
      });
    }

    const previousMessages = Array.isArray(history)
      ? history.slice(-10).map(item => {
          const role =
            item.role === "assistant" || item.role === "ai"
              ? "MY AI"
              : "User";

          return `${role}: ${item.content || item.message || ""}`;
        }).join("\n")
      : "";

    const prompt = `
You are MY AI, a helpful and friendly AI assistant.

Answer clearly and naturally in the user's language.

You can understand images.
When the user sends an image:
- Describe what is visible.
- Read text when possible.
- Explain diagrams and charts.
- Help solve exercises shown in images.
- If something is unclear, say so honestly.

${previousMessages}

User: ${message}
`;

    const input = [
      {
        type: "text",
        text: prompt
      }
    ];

    if (image) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
      ];

      if (
        typeof image.data !== "string" ||
        !allowedTypes.includes(image.mimeType)
      ) {
        return res.status(400).json({
          error: "Invalid image format"
        });
      }

      const base64 = image.data;

      if (
        base64.length > 2500000 ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)
      ) {
        return res.status(400).json({
          error: "Image is too large or invalid"
        });
      }

      input.push({
        type: "image",
        data: base64,
        mime_type: image.mimeType
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          model: "gemini-3.8-flash",
          input: input
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", data);

      return res.status(response.status).json({
        error: data.error?.message ||
          "Gemini API request failed"
      });
    }

    let reply = data.output_text;

    if (!reply && Array.isArray(data.steps)) {
      reply = data.steps
        .filter(step => step.type === "model_output")
        .flatMap(step => step.content || [])
        .filter(part => part.type === "text")
        .map(part => part.text)
        .join("\n");
    }

    if (!reply) {
      return res.status(502).json({
        error: "No response received from Gemini"
      });
    }

    return res.status(200).json({
      reply: reply
    });

  } catch (error) {
    console.error("MY AI server error:", error);

    return res.status(500).json({
      error: error.message || "Internal server error"
    });
  }
}
