import path from "path";

export async function loadTestModule(filePath) {
  const abs = path.resolve(filePath);

  try {
    await import(`file://${abs}?t=${Date.now()}`);
    return {
      ok: true,
      filePath: abs
    };
  } catch (error) {
    return {
      ok: false,
      filePath: abs,
      error: error.message
    };
  }
}