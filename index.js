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

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || ""
);

app.use(express.static(path.join(__dirname, "public")));

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
  "bcryptjs": "bcryptjs",
  "dotenv": "dotenv",
  "mongoose": "mongoose",
  "prisma": "prisma",
  "axios": "axios",
  "react": "react",
  "next": "next",
  "next.js": "next",
  "vite": "vite"
};

const PACKAGE_REFERENCES = {
  "discord.js": {
    notes: [
      "Use ESM imports.",
      "For a basic bot client, create Client with GatewayIntentBits.",
      "For slash commands, prefer SlashCommandBuilder and interactionCreate."
    ],
    install: "npm install discord.js",
    snippet: `import { Client, GatewayIntentBits } from "discord.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
  console.log(\`Logged in as \${client.user?.tag}\`);
});

client.login(process.env.BOT_TOKEN);`
  },

  "express": {
    notes: [
      "Use express.json() for JSON body parsing.",
      "Use process.env.PORT for deployment compatibility.",
      "Call app.listen only once."
    ],
    install: "npm install express",
    snippet: `import express from "express";

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(express.json());

app.get("/api/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(\`Server listening on \${port}\`);
});`
  },

  "pg": {
    notes: [
      "Use Pool from pg for PostgreSQL connections in Node.",
      "Prefer process.env.DATABASE_URL for connection configuration."
    ],
    install: "npm install pg",
    snippet: `import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export default pool;`
  },

  "drizzle-orm": {
    notes: [
      "Do not guess Drizzle adapters or import paths.",
      "If exact setup is uncertain, prefer saying Unknown rather than fabricating APIs.",
      "Use reference-based generation when possible."
    ],
    install: "npm install drizzle-orm pg",
    snippet: `// Use only verified Drizzle setup.
// If exact Drizzle adapter or import path is uncertain, respond:
// "Unknown — requires verified reference."`
  },

  "typescript": {
    notes: [
      "Do not assume Node runs .ts files directly without tsx, ts-node, or a build step.",
      "Prefer modern ESM-friendly tsconfig for Node 20+."
    ],
    install: "npm install -D typescript @types/node",
    snippet: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}`
  }
};

function forceStepModePrompt() {
  return `
You are in STRICT STEP MODE.

ABSOLUTE RULES:
- NEVER ask the user questions
- NEVER ask for clarification
- NEVER list options
- ALWAYS proceed using best-practice defaults

BEHAVIOR:
- If the user says "generate src/index.ts"
  → generate it immediately
- Do NOT ask what it should do
- Infer the correct behavior from prior planning

STEP RULES:
- If no plan exists → create Step 1 (planning)
- If plan exists → generate requested file ONLY
- NEVER regenerate plan unless asked

DEFAULTS:
- Discord bot = discord.js v14 + slash commands
- index.ts = main entry point that logs in bot and handles commands

OUTPUT RULES:
- Output ONLY the requested file
- No explanation
- No questions
`;
}

function codingRulesPrompt() {
  return `
CODING RULES (MANDATORY):
- Complete files only, no partial snippets, unless explicitly asked
- Each file must be in its own code block with the correct language tag
- First line inside each file must be: // filename: <name>
- Default to TypeScript unless told otherwise
- Use ESM imports, not CommonJS, unless explicitly requested
- Include all required imports and dependencies
- Never hardcode secrets, tokens, passwords, or database URLs — use process.env
- Match the user's existing stack and structure when modifying code
- Do not claim code is production-ready unless it truly meets the stated requirements
- Do NOT attempt complex multi-file generation in one response
- Prefer simple, minimal, correct outputs over complex ones
`;
}

function fileModePrompt() {
  return `
You are in FILE MODE.

Rules:
- Generate ONLY the single requested file
- Do not generate any other files
- Do not describe other files
- Do not plan additional steps
- Output only the requested full file
- Follow all coding rules exactly
`;
}

function debugModePrompt() {
  return `
You are in DEBUG MODE.

Rules:
- State the root issue briefly
- Then provide the corrected full file
- Prefer fixing the user's existing structure over rewriting everything
- Follow all coding rules exactly
`;
}

function isCodeRequest(message) {
  const text = message.toLowerCase();

  const signals = [
    "build",
    "create",
    "make",
    "generate",
    "scaffold",
    "fix",
    "refactor",
    "write code",
    "api",
    "bot",
    "discord",
    "express",
    "route",
    "middleware",
    "database",
    "schema",
    "typescript",
    "javascript",
    "node",
    "function",
    "class",
    "component",
    "file",
    "bug",
    "how do i make",
    "how to make",
    "how do i build"
  ];

  return signals.some((phrase) => text.includes(phrase));
}

function inferMode(message) {
  const text = message.toLowerCase();

  if (
    text.includes("fix ") ||
    text.includes("debug ") ||
    text.includes("error") ||
    text.includes("bug") ||
    text.includes("broken")
  ) {
    return "debug";
  }

  if (
    text.includes("generate only") ||
    text.includes("only this file") ||
    text.includes("only the file") ||
    text.includes("rewrite only") ||
    text.includes("fix only this file") ||
    text.includes("src/") ||
    text.includes(".ts") ||
    text.includes(".js") ||
    text.includes(".json") ||
    text.includes(".html") ||
    text.includes(".env")
  ) {
    return "file";
  }

  return "plan";
}

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
      return { name: pkgName, found: false };
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
    return { name: pkgName, found: false };
  }
}

function buildReferenceSnippetContext(packageCandidates) {
  const sections = [];

  for (const pkgName of packageCandidates) {
    const ref = PACKAGE_REFERENCES[pkgName];
    if (!ref) continue;

    const notes = Array.isArray(ref.notes) ? ref.notes : [];
    const install = ref.install || "";
    const snippet = ref.snippet || "";

    sections.push(
      [
        `Package reference: ${pkgName}`,
        install ? `Install: ${install}` : "",
        notes.length > 0 ? `Notes:\n- ${notes.join("\n- ")}` : "",
        snippet ? `Known-good usage example:\n${snippet}` : ""
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return sections.join("\n\n");
}

async function buildLiveContext(message) {
  const now = new Date();
  const timeZone = "America/New_York";

  const formattedDate = now.toLocaleDateString("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const formattedTime = now.toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short"
  });

  let liveContext = `Current real-world date and time: ${formattedDate} at ${formattedTime} (Eastern Time).`;

  const packageCandidates = extractPackageCandidates(message);
  const packageResults = await Promise.all(
    packageCandidates.map(fetchNpmPackageInfo)
  );

  if (packageResults.length > 0) {
    liveContext += `\n\nLive npm package info:\n`;
    for (const pkg of packageResults) {
      if (pkg.found) {
        liveContext += `- ${pkg.name}: latest=${pkg.latest}; description=${pkg.description}\n`;
      } else {
        liveContext += `- ${pkg.name}: not found in npm registry\n`;
      }
    }
  }

  return {
    liveContext: liveContext.trim(),
    packageCandidates
  };
}

// 🔥 NEW: auto-detect project type for .env generation
function detectProjectType(message, history) {
  const text = (message + " " + history.map((m) => m.content).join(" ")).toLowerCase();

  if (text.includes("discord") || text.includes("bot_token") || text.includes("slash command")) {
    return "discord";
  }

  if (text.includes("express") || text.includes("api") || text.includes("jwt") || text.includes("postgres")) {
    return "api";
  }

  if (text.includes("react") || text.includes("frontend") || text.includes("vite")) {
    return "frontend";
  }

  return "generic";
}

// 🔥 NEW: .env templates by project type
function getEnvTemplate(type) {
  switch (type) {
    case "discord":
      return `BOT_TOKEN=
CLIENT_ID=
GUILD_ID=
GROQ_API_KEY=
OWNER_ID=`;

    case "api":
      return `DATABASE_URL=
JWT_SECRET=
PORT=3000`;

    case "frontend":
      return `VITE_API_URL=
VITE_APP_ENV=development`;

    default:
      return `# Add your environment variables here`;
  }
}

// 🔥 NEW: summarize older messages so long chats stay stable
async function summarizeMessages(messages) {
  const text = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      {
        role: "system",
        content: "Summarize this conversation clearly. Keep key technical context, decisions, goals, and constraints."
      },
      {
        role: "user",
        content: text
      }
    ]
  });

  return completion.choices[0]?.message?.content || "";
}

async function callClaude({
  systemPrompt,
  extraSystemMessages = [],
  history = [],
  userMessage,
  summary = ""
}) {
  const systemBlocks = [
    systemPrompt,
    ...(summary ? [`Conversation summary:\n${summary}`] : []),
    ...extraSystemMessages.filter(Boolean)
  ].join("\n\n");

  const anthropicMessages = history.map((msg) => ({
    role: msg.role,
    content: msg.content
  }));

  anthropicMessages.push({
    role: "user",
    content: userMessage
  });

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    system: systemBlocks,
    messages: anthropicMessages
  });

  const text = response.content
    ?.filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return text || "Unknown — requires verified reference.";
}

app.get("/api/chat/history", async (req, res) => {
  try {
    const sessionId = String(req.query.sessionId || "default");

    const { data, error } = await supabase
      .from("messages")
      .select("role, content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("History fetch error:", error);
      return res.status(500).json({ error: "Failed to load chat history" });
    }

    return res.json({ messages: data || [] });
  } catch (err) {
    console.error("History route error:", err);
    return res.status(500).json({ error: "Failed to load chat history" });
  }
});

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

    const codeRequest = isCodeRequest(trimmedMessage);
    let effectiveMode = codeRequest ? inferMode(trimmedMessage) : "chat";

    if (trimmedMessage.toLowerCase().startsWith("generate ")) {
      effectiveMode = "file";
    }

    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(30);

    if (historyError) {
      console.error("History load error:", historyError);
    }

    const cleanHistory = (history || []).filter(
      (msg) =>
        msg &&
        (msg.role === "user" || msg.role === "assistant") &&
        typeof msg.content === "string"
    );

    // 🔥 NEW: auto-generate .env templates without using Claude/Groq
    if (trimmedMessage.toLowerCase().includes(".env")) {
      const type = detectProjectType(trimmedMessage, cleanHistory);
      const template = getEnvTemplate(type);

      const { error: userInsertError } = await supabase.from("messages").insert({
        session_id: sessionId,
        role: "user",
        content: trimmedMessage
      });

      if (userInsertError) {
        console.error("User message save error:", userInsertError);
      }

      const { error: assistantInsertError } = await supabase.from("messages").insert({
        session_id: sessionId,
        role: "assistant",
        content: template
      });

      if (assistantInsertError) {
        console.error("Assistant message save error:", assistantInsertError);
      }

      return res.json({
        reply: template,
        name: "TweakBot",
        mode: effectiveMode,
        provider: "system"
      });
    }

    // 🔥 NEW: compress older context into summaries when chats get long
    if (cleanHistory.length > 20) {
      const older = cleanHistory.slice(0, 10);
      const summaryText = await summarizeMessages(older);

      const { error: summaryInsertError } = await supabase.from("summaries").insert({
        session_id: sessionId,
        content: summaryText
      });

      if (summaryInsertError) {
        console.error("Summary save error:", summaryInsertError);
      }
    }

    // 🔥 NEW: load latest summary and inject it into model context
    const { data: summaryRows, error: summaryLoadError } = await supabase
      .from("summaries")
      .select("content")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (summaryLoadError) {
      console.error("Summary load error:", summaryLoadError);
    }

    const summary = summaryRows?.[0]?.content || "";

    const { error: userInsertError } = await supabase.from("messages").insert({
      session_id: sessionId,
      role: "user",
      content: trimmedMessage
    });

    if (userInsertError) {
      console.error("User message save error:", userInsertError);
    }

    const recentHistory =
      cleanHistory.length > 10 ? cleanHistory.slice(-10) : cleanHistory;

    let modePrompt = "";

    if (effectiveMode === "plan") {
      modePrompt = forceStepModePrompt();
    } else if (effectiveMode === "file") {
      modePrompt = fileModePrompt();
    } else if (effectiveMode === "debug") {
      modePrompt = debugModePrompt();
    }

    const { liveContext, packageCandidates } = await buildLiveContext(trimmedMessage);
    const referenceContext = buildReferenceSnippetContext(packageCandidates);

    let reply = "Unknown — requires verified reference.";
    let provider = "groq";

    if (codeRequest) {
      provider = "anthropic";

      try {
        reply = await callClaude({
          systemPrompt: SYSTEM_PROMPT,
          extraSystemMessages: [
            forceStepModePrompt(),
            codingRulesPrompt(),
            modePrompt,
            liveContext ? `Live context:\n${liveContext}` : "",
            referenceContext
              ? `Reference snippets:\n${referenceContext}\n\nIf reference context and model memory differ, prefer the reference context.`
              : ""
          ],
          history: recentHistory,
          userMessage: trimmedMessage,
          summary
        });
      } catch (err) {
        console.error("Claude failed, falling back to Groq:", err?.message || err);
        provider = "groq-fallback";

        try {
          const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              ...(summary
                ? [{ role: "system", content: `Conversation summary:\n${summary}` }]
                : []),
              { role: "system", content: forceStepModePrompt() },
              { role: "system", content: codingRulesPrompt() },
              ...(modePrompt ? [{ role: "system", content: modePrompt }] : []),
              ...(liveContext ? [{ role: "system", content: `Live context:\n${liveContext}` }] : []),
              ...(referenceContext
                ? [{
                    role: "system",
                    content:
                      `Reference snippets:\n${referenceContext}\n\n` +
                      `If reference context and model memory differ, prefer the reference context.`
                  }]
                : []),
              ...recentHistory,
              { role: "user", content: trimmedMessage }
            ]
          });

          const raw = completion.choices[0]?.message?.content;

          if (typeof raw === "string") {
            const cleaned = raw.trim();
            if (cleaned.length > 0) {
              reply = cleaned;
            }
          }
        } catch (fallbackErr) {
          console.error("Groq fallback ALSO failed:", fallbackErr?.message || fallbackErr);
        }
      }
    } else {
      const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...(summary
            ? [{ role: "system", content: `Conversation summary:\n${summary}` }]
            : []),
          ...(liveContext
            ? [{ role: "system", content: `Live context:\n${liveContext}` }]
            : []),
          ...recentHistory,
          { role: "user", content: trimmedMessage }
        ]
      });

      const raw = completion.choices[0]?.message?.content;

      if (typeof raw === "string") {
        const cleaned = raw.trim();
        if (cleaned.length > 0) {
          reply = cleaned;
        }
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
      name: "TweakBot",
      mode: effectiveMode,
      provider
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