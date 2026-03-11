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
  const USE_DEMO_MODE = process.env.DEMO_MODE === "true";
  
  // Demo mode: AI olmadan keyword matching
  if (!ANTHROPIC_API_KEY || USE_DEMO_MODE) {
    console.log("Using DEMO MODE - keyword matching instead of AI");
    return demoModeParse(subject, body, from, date, res);
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
    console.log("Sending request to Anthropic API...");
    console.log("Prompt:", prompt.substring(0, 500));
    
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

    console.log("Anthropic response status:", response.status);
    const data = await response.json();
    console.log("Anthropic response:", JSON.stringify(data, null, 2));

    if (!data.content || !data.content[0]) {
      console.error("Empty Claude response:", JSON.stringify(data));
      return res.status(200).json({ event: null });
    }

    const text = data.content[0].text || "{}";
    console.log("Extracted text:", text);
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(clean);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Parse error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

// Demo mode - AI olmadan keyword matching ile event çıkarma
function demoModeParse(subject, body, from, date, res) {
  const text = ((subject || "") + " " + (body || "")).toLowerCase();
  
  // Tarih patternleri
  const datePatterns = [
    /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/,  // 12.03.2026
    /(\d{4})-(\d{1,2})-(\d{1,2})/,          // 2026-03-12
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,        // 12/03/2026
  ];
  
  // Saat patternleri
  const timePatterns = [
    /(\d{1,2}):(\d{2})/,                    // 14:30
    /(\d{1,2})\s*[:\.]\s*(\d{2})/,          // 14.30
    /saat\s*(\d{1,2})\s*:\s*(\d{2})/,       // saat 14:30
  ];
  
  let foundDate = null;
  let foundTime = "09:00";
  let foundLocation = "";
  let foundTitle = subject || "Toplantı";
  
  // Tarih ara
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      let y, m, d;
      if (match[0].includes("-")) {
        y = match[1]; m = match[2]; d = match[3];
      } else if (match[1].length === 4) {
        y = match[1]; m = match[2]; d = match[3];
      } else {
        d = match[1]; m = match[2]; y = match[3];
      }
      foundDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      break;
    }
  }
  
  // Saat ara
  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      foundTime = `${match[1].padStart(2, '0')}:${match[2].padStart(2, '0')}`;
      break;
    }
  }
  
  // Yer ara
  const locationKeywords = ["yer:", "konum:", "oda:", "salon", "oda no", "toplantı odası", "konferans"];
  for (const kw of locationKeywords) {
    const idx = text.indexOf(kw);
    if (idx !== -1) {
      const rest = text.substring(idx + kw.length);
      const endIdx = rest.search(/[.,\n]/);
      foundLocation = endIdx > -1 ? rest.substring(0, endIdx).trim() : rest.substring(0, 50).trim();
      foundLocation = foundLocation.replace(/^\s*:\s*/, "");
      break;
    }
  }
  
  // Toplantı tipi ara
  const meetingKeywords = ["toplantı", "lanzman", "sunum", "görüşme", " брифинг", "seminer", "eğitim", "workshop"];
  for (const kw of meetingKeywords) {
    if (text.includes(kw)) {
      foundTitle = subject || `${kw.charAt(0).toUpperCase() + kw.slice(1)} Toplantısı`;
      break;
    }
  }
  
  // Eğer tarih bulamadıysak event yok
  if (!foundDate) {
    // Yine de event döndür, bugünün tarihini kullan
    const today = new Date();
    foundDate = today.toISOString().split("T")[0];
  }
  
  const event = {
    title: foundTitle,
    start: `${foundDate}T${foundTime}:00`,
    end: `${foundDate}T${parseInt(foundTime) + 1}:00`.replace("T25:", "T01:"),
    location: foundLocation || "Belirsiz",
    description: body ? body.substring(0, 200) : "",
    attendees: from ? [from] : [],
  };
  
  console.log("Demo mode extracted event:", event);
  return res.status(200).json({ event });
}
