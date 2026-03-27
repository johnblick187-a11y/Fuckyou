import fs from "fs";
import path from "path";

const BACKUP_ROOT = path.resolve("./backups");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sanitizeName(input) {
  return input.replace(/[^\w.-]/g, "_");
}

export function createBackup(filePath, label = "manual") {
  const absFilePath = path.resolve(filePath);

  if (!fs.existsSync(absFilePath)) {
    throw new Error(`createBackup: file not found: ${absFilePath}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const baseName = sanitizeName(path.basename(filePath));
  const backupDir = path.join(BACKUP_ROOT, sanitizeName(label));

  ensureDir(backupDir);

  const backupPath = path.join(backupDir, `${timestamp}__${baseName}.bak`);
  fs.copyFileSync(absFilePath, backupPath);

  return {
    ok: true,
    original: absFilePath,
    backup: backupPath,
    label,
    timestamp
  };
}

export function restoreBackup(backupPath, targetFilePath) {
  const absBackupPath = path.resolve(backupPath);
  const absTargetPath = path.resolve(targetFilePath);

  if (!fs.existsSync(absBackupPath)) {
    throw new Error(`restoreBackup: backup not found: ${absBackupPath}`);
  }

  fs.copyFileSync(absBackupPath, absTargetPath);

  return {
    ok: true,
    restoredTo: absTargetPath,
    fromBackup: absBackupPath
  };
}

export function listBackups(label = null) {
  ensureDir(BACKUP_ROOT);

  const labels = label ? [sanitizeName(label)] : fs.readdirSync(BACKUP_ROOT);

  const results = [];

  for (const folder of labels) {
    const folderPath = path.join(BACKUP_ROOT, folder);
    if (!fs.existsSync(folderPath)) continue;

    const files = fs.readdirSync(folderPath).map((name) => ({
      label: folder,
      backup: path.join(folderPath, name)
    }));

    results.push(...files);
  }

  return results;
}