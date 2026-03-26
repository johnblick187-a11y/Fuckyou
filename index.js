import express from "express";

const app = express();

app.use(express.json());
app.use(express.static("public"));

// homepage (optional, but good for testing)
app.get("/", (req, res) => {
  res.send("Agent 44 is live");
});

// chat endpoint
app.post("/api/chat", (req, res) => {
  const { message } = req.body;

  res.json({
    reply: `Agent 44 received: ${message}`
  });
});

// port setup
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Agent 44 running on port ${PORT}`);
});
