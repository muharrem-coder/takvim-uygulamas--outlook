// api/yandex-mail.js — Vercel Serverless Function
const { ImapFlow } = require("imapflow");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, appPassword } = req.body || {};
  if (!email || !appPassword) {
    return res.status(400).json({ error: "email ve appPassword gerekli" });
  }

  const client = new ImapFlow({
    host: "imap.yandex.com",
    port: 993,
    secure: true,
    auth: { user: email, pass: appPassword },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    const messages = [];

    try {
      const total = client.mailbox.exists;
      const start = Math.max(1, total - 19);

      for await (const msg of client.fetch(`${start}:${total}`, {
        envelope: true,
        source: true,
      })) {
        const from = msg.envelope?.from?.[0]
          ? `${msg.envelope.from[0].name || ""} <${msg.envelope.from[0].address || ""}>`
          : "";

        // source tüm raw maili verir, ilk 1500 karakteri alıyoruz
        let bodyText = "";
        if (msg.source) {
          const raw = msg.source.toString();
          // Header'ı atla, sadece body al
          const bodyStart = raw.indexOf("\r\n\r\n");
          bodyText = bodyStart > -1
            ? raw.substring(bodyStart + 4, bodyStart + 1504)
            : raw.substring(0, 1500);
          // base64 encoded ise decode et
          if (bodyText.match(/^[A-Za-z0-9+/=\r\n]+$/)) {
            try { bodyText = Buffer.from(bodyText.replace(/\s/g, ""), "base64").toString("utf8").substring(0, 1000); } catch {}
          }
        }

        messages.push({
          from,
          subject: msg.envelope?.subject || "",
          date: msg.envelope?.date?.toISOString() || "",
          body: bodyText,
        });
      }
    } finally {
      lock.release();
    }

    await client.logout();
    return res.status(200).json({ messages });
  } catch (err) {
    console.error("IMAP error:", err.message);
    try { await client.logout(); } catch {}
    return res.status(500).json({ error: err.message || "IMAP bağlantı hatası" });
  }
};
