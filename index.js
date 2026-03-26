import express from "express";

const app = express();
app.use(express.json());

app.post("/api/chat", (req, res) => {
  const { message } = req.body;

  res.json({
    reply: `Agent 44 received: ${message}`
  });
});

app.listen(3000, () => {
  console.log("Agent 44 running");
});
