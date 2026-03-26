import express from "express";

const app = express();
app.use(express.json());

app.post("/api/chat", (req, res) => {
  const { message } = req.body;

  res.json({
    reply: `Agent 44 received: ${message}`
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Agent 44 running on port ${PORT}`);
});
