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

/**
 * Package aliases / known package names
 */
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

/**
 * Known-good local reference snippets.
 * These are intentionally small, conservative, and easy for the model to adapt.
 * Keep these updated over time as your trusted examples improve.
 */
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
      "Keep one app.listen call only."
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
    snippet: `// Use the official Node/PostgreSQL adapter pattern from verified reference.
// If exact Drizzle setup is uncertain, respond:
// "Unknown database implementation — requires verified reference."`
  },

  "typescript": {
    notes: [
      "Do not assume Node runs .ts files directly without tsx, ts-node, or a build step.",
      "Prefer ESM-friendly tsconfig when targeting modern Node."
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
  },

  "jsonwebtoken": {
    notes: [
      "Do not hardcode JWT secrets.",
      "Use process.env.JWT_SECRET."
    ],
    install: "npm install jsonwebtoken",
    snippet: `import jwt from "jsonwebtoken";

const token = jwt.sign(
  { sub: userId },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);`
  },

  "bcrypt": {
    notes: [
      "Use bcrypt for password hashing.",
      "Never store plaintext passwords."
    ],
    install: "npm install bcrypt",
    snippet: `import bcrypt from "bcrypt";

const hash = await bcrypt.hash(password, 10);
const valid = await bcrypt.compare(password, hash);`
  },

  "zod": {
    notes: [
      "Use Zod for request validation when schema validation is needed."
    ],
    install: "npm install zod",
    snippet: `import { z } from "zod";

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});`
  }
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
  if (lower.includes("jwt")) found.add("jsonwebtoken");
  if (lower.includes("bcrypt")) found.add("bcrypt");
  if (lower.includes("zod")) found.add("zod");

  return [...found];
}

async function fetchNpmPackageInfo(pkgName) {
  try {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`
    );

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

  return {
    liveContext: liveContext.trim(),
    packageCandidates
  };
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

    const { liveContext, packageCandidates } = await buildLiveContext(trimmedMessage);
    const referenceContext = buildReferenceSnippetContext(packageCandidates);

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },

        ...(modePrompt
          ? [{ role: "system", content: modePrompt }]
          : []),

        ...(liveContext
          ? [{ role: "system", content: `Live context:\n${liveContext}` }]
          : []),

        ...(referenceContext
          ? [
              {
                role: "system",
                content: `Reference snippets:\n${referenceContext}\n\nIf reference context and model memory differ, prefer the reference context.`
              }
            ]
          : []),

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