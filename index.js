import express from "express";
import { createClient } from "@supabase/supabase-js";
import { runTask, listTasks } from "./core/taskRunner.js";
import { runAgentStep } from "./core/agentRunner.js";

const app = express();
app.use(express.json());

// 🌐 ENV
const PORT = process.env.PORT || 5000;

// 🔗 Supabase (optional)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log("✅ Supabase connected");
} else {
  console.log("⚠️ Supabase not configured (safe mode)");
}

//
// 🧠 CONTROL PANEL
//
app.get("/", (req, res) => {
  const tasks = listTasks();

  const taskButtons = tasks
    .map(
      (task) => `
        <form method="GET" action="/run/${task}" style="margin: 0 0 12px 0;">
          <button style="padding:12px 16px; font-size:16px;">
            Run ${task}
          </button>
        </form>
      `
    )
    .join("");

  res.send(`
    <h1>Agent Z Control Panel</h1>
    <p>Server is running.</p>

    <h2>Available Tasks</h2>
    <pre>${JSON.stringify(tasks, null, 2)}</pre>

    <h2>Run a Task</h2>
    ${taskButtons}

    <h2>Auto Mode</h2>
    <a href="/auto">Run Agent Step</a>
  `);
});

//
// 🔧 MANUAL TASK
//
app.get("/run/:task", async (req, res) => {
  const result = await runTask(req.params.task);

  res.send(`
    <h1>Task Result</h1>
    <pre>${JSON.stringify(result, null, 2)}</pre>
    <a href="/">Back</a>
  `);
});

//
// 🤖 AUTO MODE (brain + runner)
//
app.get("/auto", async (req, res) => {
  const result = await runAgentStep();

  res.send(`
    <h1>Agent Auto Step</h1>
    <pre>${JSON.stringify(result, null, 2)}</pre>
    <a href="/">Back</a>
  `);
});

//
// 🧠 REAL AI CHAT (THIS FIXES YOUR BOT)
//
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.json({ reply: "No message provided" });
    }

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
            content: "You are Agent Z, an evolving autonomous AI system. You think strategically, adapt, and improve yourself over time."
          },
          {
            role: "user",
            content: message
          }
        ]
      })
    });

    const data = await response.json();

    const reply =
      data?.choices?.[0]?.message?.content ||
      "No response from model";

    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.json({
      reply: "Agent Z encountered an error."
    });
  }
});

//
// 🚀 START SERVER (RENDER SAFE)
//
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Agent Z running on port ${PORT}`);
});