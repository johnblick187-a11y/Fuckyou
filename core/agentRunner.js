import OpenAI from "openai";
import SYSTEM_PROMPT from "../systemprompt.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function runAgentStep(input) {
  const safeInput =
    typeof input === "string" && input.trim()
      ? input.trim()
      : "no input provided";

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: safeInput }
      ]
    });

    return {
      reply: completion.choices[0].message.content
    };

  } catch (err) {
    console.error("AI ERROR:", err);

    return {
      reply: `AI ERROR:\n${err.message}`
    };
  }
}