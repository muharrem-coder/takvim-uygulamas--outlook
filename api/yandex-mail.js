// api/yandex-mail.js — Vercel Serverless Function
// Yandex IMAP'e bağlanır, son 20 maili okur, event içerenlerini döndürür

const Imap = require("imap");
const { simpleParser } = require("mailparser");

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email, appPassword } = req.body;
  if (!email || !appPassword) {
    return res.status(400).json({ error: "email ve appPassword gerekli" });
  }

  try {
    const messages = await fetchEmails(email, appPassword);
    return res.status(200).json({ messages });
  } catch (err) {
    console.error("IMAP error:", err.message);
    return res.status(500).json({ error: err.message || "IMAP bağlantı hatası" });
  }
}

function fetchEmails(email, password) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: email,
      password: password,
      host: "imap.yandex.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 10000,
      connTimeout: 15000,
    });

    const emails = [];

    imap.once("ready", () => {
      imap.openBox("INBOX", true, (err, box) => {
        if (err) { imap.end(); return reject(err); }

        const total = box.messages.total;
        if (total === 0) { imap.end(); return resolve([]); }

        // Son 20 mail
        const start = Math.max(1, total - 19);
        const fetch = imap.seq.fetch(`${start}:${total}`, {
          bodies: ["HEADER.FIELDS (FROM SUBJECT DATE)", "TEXT"],
          struct: true,
        });

        fetch.on("message", (msg) => {
          let buffer = "";
          let headerBuffer = "";

          msg.on("body", (stream, info) => {
            stream.on("data", (chunk) => {
              if (info.which.includes("HEADER")) {
                headerBuffer += chunk.toString("utf8");
              } else {
                buffer += chunk.toString("utf8");
              }
            });
          });

          msg.once("end", () => {
            emails.push({ header: headerBuffer, body: buffer });
          });
        });

        fetch.once("error", (err) => { imap.end(); reject(err); });

        fetch.once("end", () => {
          imap.end();
        });
      });
    });

    imap.once("error", (err) => reject(err));

    imap.once("end", () => {
      // Parse headers
      const parsed = emails.map((e) => {
        const lines = e.header.split("\n");
        const get = (field) => {
          const line = lines.find((l) => l.toLowerCase().startsWith(field.toLowerCase() + ":"));
          return line ? line.split(":").slice(1).join(":").trim() : "";
        };
        return {
          from: get("From"),
          subject: get("Subject"),
          date: get("Date"),
          body: e.body.substring(0, 1500), // AI için ilk 1500 karakter yeterli
        };
      });
      resolve(parsed);
    });

    imap.connect();
  });
}
