import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { runAgentStep } from "./core/agentRunner.js";

const app = express();
const PORT = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.redirect("/index.html");
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
    res.status(500).json({
      output: `ASK ERROR: ${error.message || "Unknown error"}`
    });
  }
});

app.listen(PORT, () => {
  console.log(`Agent Z running on port ${PORT}`);
});