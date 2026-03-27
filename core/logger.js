import fs from "fs";
import path from "path";

const LOG_PATH = path.resolve("./agent_log.json");

function readLogs() {
  if (!fs.existsSync(LOG_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(LOG_PATH, "utf-8"));
  } catch {
    return [];
  }
}

export function logEvent(event) {
  const logs = readLogs();
  logs.push({
    timestamp: new Date().toISOString(),
    ...event
  });
  fs.writeFileSync(LOG_PATH, JSON.stringify(logs, null, 2), "utf-8");
}