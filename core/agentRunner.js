import SYSTEM_PROMPT from "../systemprompt.js";

export async function runAgentStep(input) {
  const safeInput =
    typeof input === "string" && input.trim()
      ? input.trim()
      : "no input provided";

  return {
    reply: `
[Agent Z]

System Loaded: YES

User Input:
${safeInput}

Response:
Analyzing request...
Providing structured output...

→ You said: "${safeInput}"

(This is still a simulated response — AI not plugged in yet)
`
  };
}