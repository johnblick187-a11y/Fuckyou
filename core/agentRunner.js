import OpenAI from "openai";
import SYSTEM_PROMPT from "../systemprompt.js";

const apiKey = process.env.OPENAI_API_KEY || "";

const client = new OpenAI({
  apiKey
});

export async function runAgentStep(input) {
  const safeInput =
    typeof input === "string" && input.trim()
      ? input.trim()
      : "no input provided";

  if (!apiKey) {
    return {
      reply: "Missing OPENAI_API_KEY in Render environment variables."
    };
  }

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: safeInput }
      ]
    });

    const reply = completion?.choices?.[0]?.message?.content?.trim();

    return {
      reply: reply || "No response from model."
    };
  } catch (error) {
    console.error("AI ERROR:", error);

    return {
      reply: `AI ERROR: ${error.message || "Unknown OpenAI error"}`
    };
  }
}