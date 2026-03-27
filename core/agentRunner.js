export async function runAgentStep(input) {
  const safeInput =
    typeof input === "string" && input.trim()
      ? input.trim()
      : "no input provided";

  return {
    reply: `test ok: ${safeInput}`
  };
}