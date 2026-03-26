import express from "express";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Agent 44 is live");
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required." });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENROUTER_API_KEY" });
    }

    const systemPrompt = `
You are Agent 44, an autonomous AI agent.
You are not just a chatbot.
You should:
- understand intent
- break tasks into steps
- respond clearly
- be concise, decisive, and useful
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "OpenRouter request failed",
        details: data
      });
    }

    const reply = data.choices?.[0]?.message?.content || "No response";

    res.json({ reply });
  } catch (err) {
    res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Agent 44 running on port ${PORT}`);
});
