import express from "express";

const app = express();

app.use(express.json());
app.use(express.static("public"));

// 🧠 simple memory (resets on restart)
const memory = [];

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  // store user message
  memory.push({ role: "user", content: message });

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are Agent Z, a smart, strategic AI agent with memory of past messages."
          },
          ...memory
        ]
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "No response";

    // store AI response
    memory.push({ role: "assistant", content: reply });

    res.json({ reply });

  } catch (err) {
    res.json({ reply: "Error contacting AI" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Agent 44 running on port ${PORT}`);
});
