import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";

const app = express();
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

// 🔥 Init Groq
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// ✅ Serve TweakBot UI
app.use(express.static(path.join(__dirname, "public")));

// ✅ Chat endpoint (TweakBot personality)
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "No message provided" });
    }

    const completion = await groq.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [
        {
          role: "system",
          content: `
You are TweakBot.

Identity:
- Name: TweakBot
- Tone: sharp, confident, slightly aggressive but controlled
- Style: short, direct, high signal, no fluff
- Purpose: assist, build, debug, execute

Rules:
- Do NOT say "Agent Z"
- Always refer to yourself as TweakBot
- Be efficient and decisive
- Avoid long explanations unless asked
`
        },
        {
          role: "user",
          content: message
        }
      ]
    });

    const reply = completion.choices[0]?.message?.content || "TweakBot: No response";

    res.json({ reply });

  } catch (err) {
    console.error("TweakBot error:", err);
    res.status(500).json({ error: "TweakBot failed" });
  }
});

// ✅ Health check
app.get("/api/healthz", (req, res) => {
  res.json({ status: "TweakBot online" });
});

// ✅ Root fallback
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// 🚀 Start server
app.listen(PORT, () => {
  console.log(`🔥 TweakBot running on port ${PORT}`);
});