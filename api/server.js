// Local development server for API functions
require("dotenv").config({ path: "../.env.local" });
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

// Load API functions
const yandexMailHandler = require("./yandex-mail.js");
const parseEventHandler = require("./parse-event.js");

// Routes
app.post("/yandex-mail", (req, res) => {
  // Wrap Vercel handler for Express
  const mockRes = {
    setHeader: (k, v) => res.set(k, v),
    status: (code) => { res.statusCode = code; return mockRes; },
    json: (data) => res.json(data),
    end: () => res.end(),
  };
  yandexMailHandler(req, mockRes);
});

app.post("/parse-event", (req, res) => {
  const mockRes = {
    setHeader: (k, v) => res.set(k, v),
    status: (code) => { res.statusCode = code; return mockRes; },
    json: (data) => res.json(data),
    end: () => res.end(),
  };
  parseEventHandler(req, mockRes);
});

app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`   - POST /yandex-mail`);
  console.log(`   - POST /parse-event`);
  console.log(`   \n⚠️  Make sure ANTHROPIC_API_KEY is set in .env.local`);
});
