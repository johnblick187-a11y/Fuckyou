import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || ""
);

const SYSTEM_PROMPT = `
You are TweakBot.
- Tone: sharp, confident, slightly aggressive but controlled
- Style: short, direct, high signal, no fluff
- Purpose: assist, build, debug, execute
- Always refer to yourself as TweakBot
- Be efficient and decisive
- Avoid long explanations unless asked
`;

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId = "default" } = req.body;

    if (!message) return res.status(400).json({ error: "No message provided" });

    // Load history
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    // Save user message
    await supabase.from("messages").insert({ session_id: sessionId, role: "user", content: message });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...(history || []),
        { role: "user", content: message }
      ]
    });

    const reply = completion.choices[0]?.message?.content || "No response";

    // Save assistant reply
    await supabase.from("messages").insert({ session_id: sessionId, role: "assistant", content: reply });

    res.json({ reply });

  } catch (err) {
    console.error("TweakBot error:", err);
    res.status(500).json({ error: "TweakBot failed" });
  }
});

app.get("/api/healthz", (req, res) => {
  res.json({ status: "TweakBot online" });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.listen(PORT, () => {
  console.log(`TweakBot running on port ${PORT} 🚀`);
});
