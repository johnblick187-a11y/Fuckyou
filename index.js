import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());

// Fix __dirname for ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Railway PORT
const PORT = process.env.PORT || 3000;

// ✅ Serve chat UI
app.use(express.static(path.join(__dirname, "public")));

// ✅ Chat API (connect to Groq later)
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "No message provided" });
    }

    // TEMP response (replace with AI later)
    res.json({
      reply: `You said: ${message}`
    });

  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Health check (Railway uses this)
app.get("/api/healthz", (req, res) => {
  res.json({ status: "ok" });
});

// ✅ Root fallback (if UI doesn't load)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});