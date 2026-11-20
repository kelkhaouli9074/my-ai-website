
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "API key missing" });
  }

  const { message, history = [] } = req.body || {};

  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  const contents = [];

  for (const item of history.slice(-6)) {
    if (!item || typeof item.content !== "string") continue;

    contents.push({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content.slice(0, 4000) }]
    });
  }

  contents.push({
    role: "user",
    parts: [{ text: message.slice(0, 4000) }]
  });

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

  // Retry only temporary server overload errors
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      let response;

      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              maxOutputTokens: 600,
              temperature: 0.7
            }
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      const data = await response.json();

      if (response.status === 503 ||
          response.status === 502 ||
          response.status === 504 ||
          response.status === 500) {

        if (attempt < 2) {
          await new Promise(resolve =>
            setTimeout(resolve, 1000 * (attempt + 1))
          );
          continue;
        }
      }

      if (!response.ok) {
        return res.status(response.status).json({
          error: data.error?.message || "Gemini request failed"
        });
      }

      const reply = data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("");

      if (!reply) {
        return res.status(502).json({
          error: "The AI returned an empty response"
        });
      }

      return res.status(200).json({ reply });

    } catch (error) {
      if (attempt < 2 && error.name !== "AbortError") {
        await new Promise(resolve =>
          setTimeout(resolve, 1000 * (attempt + 1))
        );
        continue;
      }

      return res.status(504).json({
        error: error.name === "AbortError"
          ? "The AI took too long. Please try again."
          : "Connection failed. Please try again."
      });
    }
  }
}
