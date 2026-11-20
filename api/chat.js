
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing"
      });
    }

    const { message, history = [] } = req.body || {};

    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const contents = [];

    for (const item of history.slice(-10)) {
      if (!item || typeof item.content !== "string") continue;

      contents.push({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content }]
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: message }]
    });

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({ contents })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Gemini API error"
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("");

    return res.status(200).json({
      reply: reply || "No answer returned."
    });

  } catch (error) {
    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
