// api/parse-event.js — Vercel Serverless Function
// Mail içeriğini Claude API'ye gönderir, event bilgilerini çıkarır

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { subject, body, from, date } = req.body;
  if (!subject && !body) {
    return res.status(400).json({ error: "subject veya body gerekli" });
  }

  // quoted-printable decode
  function decodeQP(str) {
    return str
      .replace(/=\r\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  // base64 decode
  function decodeB64(str) {
    try { return Buffer.from(str.replace(/\s/g, ""), "base64").toString("utf8"); } catch { return str; }
  }

  function cleanBody(raw) {
    if (!raw) return "";
    let text = raw;
    // base64 encoded block
    if (/^[A-Za-z0-9+/=\r\n]{40,}$/.test(raw.trim())) {
      text = decodeB64(raw.trim());
    }
    // quoted-printable
    if (text.includes("=C3=") || text.includes("=C4=") || text.includes("=\r\n")) {
      text = decodeQP(text);
    }
    // HTML etiketlerini temizle
    text = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return text.substring(0, 1500);
  }

  const cleanSubject = decodeQP(subject || "");
  const cleanBodyText = cleanBody(body || "");

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY eksik" });
  }

  const prompt = `Aşağıdaki e-posta içeriğini analiz et. Eğer bu e-postada bir etkinlik, toplantı, randevu, davet, webinar, konferans veya takvime eklenebilecek bir olay varsa, bilgileri JSON formatında çıkar. Yoksa {"event": null} döndür.

E-posta:
Gönderen: ${from || ""}
Konu: ${cleanSubject}
Tarih: ${date || ""}
İçerik: ${cleanBodyText}

Sadece JSON döndür, başka hiçbir şey yazma:
{
  "event": {
    "title": "etkinlik başlığı",
    "start": "YYYY-MM-DDTHH:MM:SS",
    "end": "YYYY-MM-DDTHH:MM:SS",
    "location": "yer veya online link",
    "description": "kısa açıklama",
    "attendees": ["email1", "email2"]
  }
}

Eğer saat belirsizse 09:00 varsayılan olarak kullan. Tarih belirsizse null döndür.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || "{}";

    // JSON parse
    const clean = text.replace(/```json|```/g, "").trim();
    const result = JSON.parse(clean);

    return res.status(200).json(result);
  } catch (err) {
    console.error("Parse error:", err.message);
    return res.status(500).json({ error: "AI parse hatası: " + err.message });
  }
}
