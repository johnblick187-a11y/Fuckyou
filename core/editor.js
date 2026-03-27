import fs from "fs";
import path from "path";
import { createBackup } from "./rollback.js";

export function readTextFile(filePath) {
  const abs = path.resolve(filePath);

  if (!fs.existsSync(abs)) {
    throw new Error(`readTextFile: file not found: ${abs}`);
  }

  return fs.readFileSync(abs, "utf-8");
}

export function writeTextFile(filePath, content, backupLabel = "edit") {
  const abs = path.resolve(filePath);

  if (!fs.existsSync(abs)) {
    throw new Error(`writeTextFile: file not found: ${abs}`);
  }

  const backupInfo = createBackup(abs, backupLabel);
  fs.writeFileSync(abs, content, "utf-8");

  return {
    ok: true,
    filePath: abs,
    backup: backupInfo.backup
  };
}

export function replaceInFile(filePath, findText, replaceText, backupLabel = "replace") {
  const current = readTextFile(filePath);

  if (!current.includes(findText)) {
    throw new Error(`replaceInFile: target text not found in ${filePath}`);
  }

  const updated = current.replace(findText, replaceText);
  return writeTextFile(filePath, updated, backupLabel);
}