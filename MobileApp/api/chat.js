// Vercel serverless function: the website sends chat messages here and this
// function calls OpenAI with the key stored on Vercel (OPENAI_API_KEY), so the
// key never reaches the browser.
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const MODEL = "gpt-4o-mini";
const MAX_MESSAGES = 40;
const MAX_CHARS = 8000;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }

  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    return res
      .status(500)
      .json({ error: { message: "OPENAI_API_KEY is not set on the server." } });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  const messages = Array.isArray(body && body.messages) ? body.messages : null;
  if (!messages || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return res.status(400).json({ error: { message: "Invalid messages." } });
  }
  const cleaned = messages.map((m) => ({
    role: ["system", "user", "assistant"].includes(m && m.role) ? m.role : "user",
    content: String((m && m.content) || "").slice(0, MAX_CHARS),
  }));

  try {
    const upstream = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: cleaned,
        temperature: typeof body.temperature === "number" ? body.temperature : 0.4,
        max_tokens: Math.min(Number(body.max_tokens) || 400, 600),
      }),
    });
    const text = await upstream.text();
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) res.setHeader("Retry-After", retryAfter);
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    return res.send(text);
  } catch (err) {
    return res
      .status(502)
      .json({ error: { message: "Server could not reach OpenAI." } });
  }
};