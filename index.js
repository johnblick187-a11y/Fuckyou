import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";
import SYSTEM_PROMPT from "./systemprompt.js"; // ✅ using external prompt

const app = express();
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || ""
);

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId = "default" } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "No message provided" });
    }

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return res.status(400).json({ error: "No message provided" });
    }

    // Load history
    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    if (historyError) {
      console.error("History load error:", historyError);
    }

    // Save user message
    await supabase.from("messages").insert({
      session_id: sessionId,
      role: "user",
      content: trimmedMessage
    });

    // Clean history (prevent system contamination)
    const cleanHistory = (history || []).filter(
      (msg) =>
        msg &&
        (msg.role === "user" || msg.role === "assistant") &&
        typeof msg.content === "string"
    );

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...cleanHistory,
        { role: "user", content: trimmedMessage }
      ]
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() || "No response";

    // Save assistant reply
    await supabase.from("messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: reply
    });

    return res.json({
      reply,
      name: "TweakBot"
    });
  } catch (err) {
    console.error("TweakBot error:", err);
    return res.status(500).json({ error: "TweakBot failed" });
  }
});

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "TweakBot online" });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.listen(PORT, () => {
  console.log(`TweakBot running on port ${PORT} 🚀`);
});