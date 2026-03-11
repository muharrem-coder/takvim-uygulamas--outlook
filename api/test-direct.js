// Direct test - no server needed
require("dotenv").config({ path: "../.env.local" });

const parseEventHandler = require("./parse-event.js");

// Mock request and response
const req = {
  method: "POST",
  body: {
    subject: 'Toplantı Daveti: Proje Lansmanı - Yarın 14:00',
    body: 'Merhaba, Proje lansman toplantısı yarın (12 Mart 2026) saat 14:00-15:30 arasında yapılacak. Yer: Konferans Salonu A. Lütfen zamanında geliniz.',
    from: 'ahmet@ornek.com',
    date: '2026-03-11T10:00:00Z'
  }
};

const res = {
  statusCode: 200,
  headers: {},
  setHeader(k, v) { this.headers[k] = v; },
  status(code) { this.statusCode = code; return this; },
  json(data) { 
    console.log("\n=== RESPONSE ===");
    console.log("Status:", this.statusCode);
    console.log("Data:", JSON.stringify(data, null, 2));
    console.log("==============\n");
  },
  end() {}
};

console.log("Testing parse-event directly...\n");
parseEventHandler(req, res);
