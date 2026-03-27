import express from "express";
import { createClient } from "@supabase/supabase-js";

const app = express();

app.use(express.json());
app.use(express.static("public"));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const NORMAL_PROMPT = `
You are AgentZ, a smart, strategic AI agent with persistent memory.
Be clear, useful, concise, and practical.
When helping with projects, prefer structured outputs and actionable steps.
`;

const LILITH_REBUILD_PROMPT = `
You are AgentZ in Lilith rebuild mode.

Your task is to reconstruct, restore, or upgrade the Discord bot project called Lilith from saved specs, templates, and user instructions.

Primary objective:
- rebuild Lilith as a working Node.js Discord bot project
- prefer complete, deployable output over partial snippets
- preserve saved Lilith architecture and behavior whenever possible

Rules:
- Output complete files when rebuilding
- Prefer practical, paste-ready code
- Keep the structure modular
- Include full file paths when generating code
- Include package.json, main entry, handlers, config examples, and deployment notes when needed
- If some information is missing, infer the safest working default
- Never invent secrets, tokens, API keys, or credentials
- Never claim code was tested if it was not
- Never skip required setup instructions
- When asked to rebuild a feature, regenerate the full relevant file(s), not just fragments
- Preserve backward compatibility where reasonable
- Favor stability and clarity over cleverness

Saved project assumptions:
- Lilith is a Discord bot
- Lilith is built in Node.js
- Lilith uses slash commands
- Lilith may include moderation, music, personality, memory, and utility systems
- Lilith rebuild requests should return complete files, folder structure, required environment variables, and setup steps

Response behavior:
- For full rebuilds, return:
  1. folder structure
  2. required files
  3. full file contents
  4. required env vars
  5. deployment/run steps
- For partial rebuilds, return:
  1. affected files
  2. full replacement code for those files
  3. any env var or dependency changes
  4. restart/redeploy instructions

Do not act like a generic chatbot.
Act like a reconstruction engineer for Lilith.
`;

function isLilithRebuildRequest(message) {
  const text = (message || "").toLowerCase();
  return (
    text.includes("rebuild lilith") ||
    text.includes("restore lilith") ||
    text.includes("recreate lilith") ||
    text.includes("repair lilith") ||
    text.includes("rebuild the bot") ||
    text.includes("restore the bot")
  );
}

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
      .limit(30);

    if (memoryError) throw memoryError;

    const systemPrompt = isLilithRebuildRequest(message)
      ? LILITH_REBUILD_PROMPT
      : NORMAL_PROMPT;

    const messages = [
      { role: "system", content: systemPrompt },
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

    if (!response.ok) {
      throw new Error(data?.error?.message || "OpenRouter request failed");
    }

    const reply = data.choices?.[0]?.message?.content || "No response";

    await supabase.from("agent_memory").insert({
      role: "assistant",
      content: reply
    });

    res.json({ reply });
  } catch (err) {
    res.status(500).json({
      reply: "Error using AgentZ memory/rebuild mode",
      error: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`AgentZ running on port ${PORT}`);
});
