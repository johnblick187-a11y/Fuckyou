import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";
import SYSTEM_PROMPT from "./systemprompt.js";

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

// Common package aliases / known packages
const PACKAGE_ALIASES = {
  "discordjs": "discord.js",
  "discord.js": "discord.js",
  "drizzle": "drizzle-orm",
  "drizzle-orm": "drizzle-orm",
  "pg": "pg",
  "express": "express",
  "typescript": "typescript",
  "ts-node": "ts-node",
  "tsx": "tsx",
  "zod": "zod",
  "jsonwebtoken": "jsonwebtoken",
  "bcrypt": "bcrypt",
  "dotenv": "dotenv",
  "mongoose": "mongoose",
  "prisma": "prisma",
  "axios": "axios",
  "react": "react",
  "next": "next",
  "next.js": "next",
  "vite": "vite"
};

function extractPackageCandidates(message) {
  const lower = message.toLowerCase();
  const matches = lower.match(/[a-z0-9@._/-]+/g) || [];
  const found = new Set();

  for (const token of matches) {
    if (PACKAGE_ALIASES[token]) {
      found.add(PACKAGE_ALIASES[token]);
    }
  }

  if (lower.includes("discord")) found.add("discord.js");
  if (lower.includes("drizzle")) found.add("drizzle-orm");
  if (lower.includes("postgres") || lower.includes("postgresql")) found.add("pg");
  if (lower.includes("express")) found.add("express");
  if (lower.includes("typescript")) found.add("typescript");

  return [...found];
}

async function fetchNpmPackageInfo(pkgName) {
  try {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}`);

    if (!response.ok) {
      return {
        name: pkgName,
        found: false
      };
    }

    const data = await response.json();

    return {
      name: data.name || pkgName,
      found: true,
      latest: data["dist-tags"]?.latest || "unknown",
      description: data.description || "No description",
      homepage: data.homepage || data.repository?.url || "No homepage"
    };
  } catch (error) {
    console.error(`npm lookup failed for ${pkgName}:`, error);
    return {
      name: pkgName,
      found: false
    };
  }
}

async function buildLiveContext(message) {
  const now = new Date().toString();

  const packageCandidates = extractPackageCandidates(message);
  const packageResults = await Promise.all(
    packageCandidates.map(fetchNpmPackageInfo)
  );

  let liveContext = `Current server date/time: ${now}\n`;

  if (packageResults.length > 0) {
    liveContext += `\nLive npm package info:\n`;

    for (const pkg of packageResults) {
      if (pkg.found) {
        liveContext += `- ${pkg.name}: latest=${pkg.latest}; description=${pkg.description}\n`;
      } else {
        liveContext += `- ${pkg.name}: not found in npm registry\n`;
      }
    }
  }

  return liveContext.trim();
}

app.post("/api/chat", async (req, res) => {
  try {
    const { message, sessionId = "default", mode = "chat" } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "No message provided" });
    }

    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return res.status(400).json({ error: "No message provided" });
    }

    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    if (historyError) {
      console.error("History load error:", historyError);
    }

    await supabase.from("messages").insert({
      session_id: sessionId,
      role: "user",
      content: trimmedMessage
    });

    const cleanHistory = (history || []).filter(
      (msg) =>
        msg &&
        (msg.role === "user" || msg.role === "assistant") &&
        typeof msg.content === "string"
    );

    let modePrompt = "";

    if (mode === "plan") {
      modePrompt = `
You are in PLAN MODE.
Output ONLY:
- file structure
- packages used
- short explanation
NO code.
`;
    } else if (mode === "file") {
      modePrompt = `
You are in FILE MODE.
Generate ONLY the requested file.
Do not generate any other files.
`;
    } else if (mode === "debug") {
      modePrompt = `
You are in DEBUG MODE.
State the root issue briefly.
Then provide the corrected full file.
`;
    }

    const liveContext = await buildLiveContext(trimmedMessage);

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...(modePrompt ? [{ role: "system", content: modePrompt }] : []),
        ...(liveContext ? [{ role: "system", content: `Live context:\n${liveContext}` }] : []),
        ...cleanHistory,
        { role: "user", content: trimmedMessage }
      ]
    });

    const raw = completion.choices[0]?.message?.content;

    let reply = "Unknown — requires verified reference.";

    if (typeof raw === "string") {
      const cleaned = raw.trim();
      if (cleaned.length > 0) {
        reply = cleaned;
      }
    }

    const { error: assistantInsertError } = await supabase.from("messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: reply
    });

    if (assistantInsertError) {
      console.error("Assistant message save error:", assistantInsertError);
    }

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