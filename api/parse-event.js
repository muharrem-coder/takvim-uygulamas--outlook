// api/parse-event.js - Vercel Serverless Function
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { subject, body, from, date } = req.body;
  if (!subject && !body) return res.status(400).json({ error: "missing fields" });

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not configured");
    return res.status(500).json({ error: "API key missing - configure ANTHROPIC_API_KEY in Vercel environment" });
  }

  function decodeQP(str) {
    if (!str) return "";
    return str.replace(/=\r\n/g, "").replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }

  function decodeB64(str) {
    try { return Buffer.from(str.replace(/\s/g, ""), "base64").toString("utf8"); } catch { return str; }
  }

  function cleanBody(raw) {
    if (!raw) return "";
    let text = raw;
    if (/^[A-Za-z0-9+/=\r\n]{60,}$/.test(raw.trim())) {
      text = decodeB64(raw.trim());
    }
    if (text.includes("=C3=") || text.includes("=C4=") || text.includes("=\r\n")) {
      text = decodeQP(text);
    }
    text = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text.substring(0, 1500);
  }

  const cleanedSubject = decodeQP(subject || "");
  const cleanedBody = cleanBody(body || "");

  const prompt = "Analyze this email and extract calendar event info as JSON. If no event found, return {\"event\":null}.\n\nFrom: " + (from || "") + "\nSubject: " + cleanedSubject + "\nDate: " + (date || "") + "\nBody: " + cleanedBody + "\n\nReturn ONLY valid JSON, nothing else:\n{\"event\":{\"title\":\"...\",\"start\":\"YYYY-MM-DDTHH:MM:SS\",\"end\":\"YYYY-MM-DDTHH:MM:SS\",\"location\":\"...\",\"description\":\"...\",\"attendees\":[]}}\nIf time unknown use 09:00. If date unknown return {\"event\":null}.";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    if (!data.content || !data.content[0]) {
      console.error("Empty Claude response:", JSON.stringify(data));
      return res.status(200).json({ event: null });
    }

    const text = data.content[0].text || "{}";
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(clean);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Parse error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
