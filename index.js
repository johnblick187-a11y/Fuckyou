import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { runTask, listTasks } from "./core/taskRunner.js";
import { runAgentStep } from "./core/agentRunner.js";

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  const tasks = listTasks();

  const taskButtons = tasks
    .map(
      (task) => `
        <form method="GET" action="/run/${encodeURIComponent(task)}" style="margin: 0 0 12px 0;">
          <button type="submit" style="padding: 10px 14px;">Run ${task}</button>
        </form>
      `
    )
    .join("");

  res.send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Agent Z Control Panel</title>
      </head>
      <body style="font-family: Arial, sans-serif; padding: 24px;">
        <h1>Agent Z Control Panel</h1>
        <p>Server is running.</p>

        <h2>Available Tasks</h2>
        <pre>${JSON.stringify(tasks, null, 2)}</pre>

        <h2>Run a Task</h2>
        ${taskButtons || "<p>No tasks available.</p>"}

        <h2>Auto Mode</h2>
        <form method="GET" action="/agent-step" style="margin-bottom: 12px;">
          <input
            type="text"
            name="input"
            placeholder="Tell Agent Z what to do"
            style="padding: 10px; width: 260px; max-width: 100%;"
          />
          <button type="submit" style="padding: 10px 14px;">Run Agent Step</button>
        </form>

        <p><a href="/public/index.html">Open chat UI</a></p>
      </body>
    </html>
  `);
});

app.get("/run/:task", async (req, res) => {
  try {
    const taskName = req.params.task;
    const result = await runTask(taskName, { source: "control-panel" });

    res.send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Task Result</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h1>Task Result</h1>
          <pre>${JSON.stringify(result, null, 2)}</pre>
          <p><a href="/">Back</a></p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("TASK ERROR:", error);
    res.status(500).send(`
      <h1>Task Error</h1>
      <pre>${String(error?.stack || error)}</pre>
      <p><a href="/">Back</a></p>
    `);
  }
});

app.get("/agent-step", async (req, res) => {
  try {
    const input =
      typeof req.query.input === "string" && req.query.input.trim()
        ? req.query.input.trim()
        : "no input provided";

    const result = await runAgentStep(input);

    res.send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <title>Agent Auto Step</title>
        </head>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h1>Agent Auto Step</h1>
          <pre>${JSON.stringify(result, null, 2)}</pre>
          <p><a href="/">Back</a></p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("AGENT ERROR:", error);
    res.status(500).send(`
      <h1>Agent Error</h1>
      <pre>${String(error?.stack || error)}</pre>
      <p><a href="/">Back</a></p>
    `);
  }
});

app.post("/ask", async (req, res) => {
  try {
    const input =
      typeof req.body.input === "string" && req.body.input.trim()
        ? req.body.input.trim()
        : "no input provided";

    const result = await runAgentStep(input);
    res.json({ output: result });
  } catch (error) {
    console.error("ASK ERROR:", error);
    res.status(500).json({ output: "Error processing request" });
  }
});

app.listen(PORT, () => {
  console.log(`Agent Z running on port ${PORT}`);
});