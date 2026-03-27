import SYSTEM_PROMPT from "../systemprompt.js";

export async function runAgentStep(input) {
  const safeInput =
    typeof input === "string" && input.trim()
      ? input.trim()
      : "no input provided";

  // ⚠️ Replace this later with real AI API
  const response = simulateThinking(SYSTEM_PROMPT, safeInput);

  return {
    input: safeInput,
    reply: response,
  };
}

// 🔥 TEMP "AI" (so it actually feels alive)
function simulateThinking(system, input) {
  return `
[Agent Z Thinking]

System:
${system.slice(0, 120)}...

User:
${input}

Response:
Analyzing request... forming structured response...

→ You asked: "${input}"
→ Interpreting intent...
→ Generating response...

This is a placeholder AI response. System prompt is loaded successfully.
`;
}