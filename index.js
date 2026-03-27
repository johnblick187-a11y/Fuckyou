import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();

app.use(express.json());
app.use(express.static("public"));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.post("/api/chat", async (req, res) => {
  const { message } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({ reply: "Message is required." });
  }

  try {
    await supabase.from("agent_memory").insert({
      role: "user",
      content: message
    });

    const { data: memoryRows, error: memoryError } = await supabase
      .from("agent_memory")
      .select("role, content")
      .order("created_at", { ascending: true })
      .limit(20);

    if (memoryError) throw memoryError;

    const messages = [
      {
        role: "system",
        content:
          "You are Agent Z, a smart, strategic AI agent with persistent memory of prior messages. Be clear, useful, and concise."
      },
      ...(memoryRows || []).map((row) => ({
        role: row.role,
        content: row.content
      }))
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "No response";

    await supabase.from("agent_memory").insert({
      role: "assistant",
      content: reply
    });

    res.json({ reply });
  } catch (err) {
    res.status(500).json({
      reply: "Error using persistent memory",
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Agent Z running on port ${PORT}`);
});
