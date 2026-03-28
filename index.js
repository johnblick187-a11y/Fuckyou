import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());
app.use(express.static("public"));

// 🌐 ENV
const PORT = process.env.PORT || 5000;

// 🧠 OpenAI Client (GPT-5.4)
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🧠 AGENT Z CORE ROUTE
app.post("/api/chat", async (req, res) => {
  try {
    const userMessage = req.body.message || "";

    if (!userMessage) {
      return res.status(400).json({
        error: "No message provided",
      });
    }

    const response = await client.responses.create({
      model: "gpt-5.4-mini", // 🔥 switch to "gpt-5.4" later
      input: [
        {
          role: "developer",
          content: `
You are Agent Z.

Traits:
- highly analytical
- execution-focused
- precise
- strategic thinker
- no fluff, no filler

Behavior:
- break down problems clearly
- give actionable steps
- think like an operator, not a chatbot
- challenge weak assumptions
`
        },
        {
          role: "user",
          content: userMessage,
        }
      ],
    });

    const reply =
      response.output_text ||
      response.output?.[0]?.content?.[0]?.text ||
      "No response";

    res.json({ reply });

  } catch (err) {
    console.error("❌ OpenAI Error:", err);

    res.status(500).json({
      error: err.message || "Something broke",
    });
  }
});

// 🧪 HEALTH CHECK
app.get("/health", (req, res) => {
  res.send("Agent Z is alive");
});

// 🚀 START SERVER
app.listen(PORT, () => {
  console.log(`🚀 Agent Z running on port ${PORT}`);
});