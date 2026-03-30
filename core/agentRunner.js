import Groq from "groq-sdk";
import { createClient } from "@supabase/supabase-js";
import SYSTEM_PROMPT from "../systemprompt.js";

const apiKey = process.env.GROQ_API_KEY || "";
const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || ""
);

const client = new Groq({ apiKey });

async function loadHistory(sessionId) {
  const { data } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(20);
  return data || [];
}

async function saveMessage(sessionId, role, content) {
  await supabase.from("messages").insert({ session_id: sessionId, role, content });
}

export async function runAgentStep(input, sessionId = "default") {
  const safeInput =
    typeof input === "string" && input.trim()
      ? input.trim()
      : "no input provided";

  if (!apiKey) {
    return { reply: "Missing GROQ_API_KEY in environment variables." };
  }

  const history = await loadHistory(sessionId);
  await saveMessage(sessionId, "user", safeInput);

  try {
    const completion = await client.chat.completions.create({
      model: "llama3-70b-8192",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
        { role: "user", content: safeInput }
      ]
    });

    const reply = completion?.choices?.[0]?.message?.content?.trim() || "No response from model.";
    await saveMessage(sessionId, "assistant", reply);

    return { reply };
  } catch (error) {
    console.error("AI ERROR:", error);
    return { reply: `AI ERROR: ${error.message || "Unknown Groq error"}` };
  }
}
