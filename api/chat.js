
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const { message, history = [] } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing"
      });
    }

    const contents = [];

    for (const item of history.slice(-12)) {
      if (!item || !item.content) continue;

      contents.push({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: String(item.content) }]
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
      encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini error:", data);

      return res.status(response.status).json({
        error: data.error?.message || "Gemini API error"
      });
    }

    const reply =
      data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("") || "";

    if (!reply) {
      return res.status(502).json({
        error: "The AI returned an empty response"
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Chat error:", error);

    return res.status(500).json({
      error: "Internal server error"
    });
  }
}
