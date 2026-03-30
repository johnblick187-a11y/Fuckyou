// filename: index.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import SYSTEM_PROMPT from "./systemprompt.js";

const app = express();
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || ""
);

app.use(express.static(path.join(__dirname, "public")));

// ======================
// SIMPLE CHAT DETECTION
// ======================
function isCodeRequest(message) {
  const text = message.toLowerCase();

  return [
    "build","create","generate","fix","api","bot","express",
    "database","function","class","typescript","javascript"
  ].some(x => text.includes(x));
}

// ======================
// CLEAN CHAT MODE FIX
// ======================
function cleanReply(text) {
  if (!text) return "Something went wrong.";

  // 🔥 remove annoying fallback phrase
  if (text.includes("Unknown — requires verified reference")) {
    return "I got you. Ask again or give more detail.";
  }

  return text;
}

// ======================
// CHAT ROUTE
// ======================
app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId = "default" } = req.body;
    const trimmed = message?.trim();

    if (!trimmed) {
      return res.status(400).json({ error: "No message provided" });
    }

    // save user message
    await supabase.from("messages").insert({
      session_id: sessionId,
      role: "user",
      content: trimmed
    });

    // load history
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(10);

    let reply = "";

    // ======================
    // NORMAL CHAT (FIXED)
    // ======================
    if (!isCodeRequest(trimmed)) {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are a normal conversational AI. Speak naturally. Do not mention 'verified reference'."
          },
          ...history,
          { role: "user", content: trimmed }
        ]
      });

      reply = completion.choices[0]?.message?.content || "";
    }

    // ======================
    // CODE MODE (unchanged idea)
    // ======================
    else {
      try {
        const response = await anthropic.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: [
            ...history,
            { role: "user", content: trimmed }
          ]
        });

        reply = response.content?.[0]?.text || "";
      } catch {
        reply = "Code generation failed.";
      }
    }

    reply = cleanReply(reply);

    // save assistant
    await supabase.from("messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: reply
    });

    res.json({
      reply,
      name: "TweakBot"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "TweakBot failed" });
  }
});

// ======================
app.get("/api/healthz", (_req, res) => {
  res.json({ status: "TweakBot online" });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.listen(PORT, () => {
  console.log(`TweakBot running on port ${PORT} 🚀`);
});