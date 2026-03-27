import { readTextFile, writeTextFile } from "./editor.js";
import { restoreBackup } from "./rollback.js";
import { loadTestModule } from "./tester.js";
import { logEvent } from "./logger.js";

export async function selfModify({
  targetFile,
  goal,
  transform,
  backupLabel = "self-mod"
}) {
  let writeResult;

  try {
    const before = readTextFile(targetFile);
    const after = transform(before);

    if (typeof after !== "string") {
      throw new Error("transform must return a string");
    }

    if (after === before) {
      logEvent({
        type: "no_change",
        goal,
        targetFile
      });

      return {
        ok: true,
        changed: false,
        targetFile
      };
    }

    writeResult = writeTextFile(targetFile, after, backupLabel);

    const test = await loadTestModule(targetFile);

    if (!test.ok) {
      restoreBackup(writeResult.backup, targetFile);

      logEvent({
        type: "rollback",
        goal,
        targetFile,
        backup: writeResult.backup,
        error: test.error
      });

      return {
        ok: false,
        rolledBack: true,
        targetFile,
        error: test.error
      };
    }

    logEvent({
      type: "success",
      goal,
      targetFile,
      backup: writeResult.backup
    });

    return {
      ok: true,
      changed: true,
      targetFile,
      backup: writeResult.backup
    };
  } catch (err) {
    logEvent({
      type: "error",
      goal,
      targetFile,
      error: err.message
    });

    return {
      ok: false,
      error: err.message,
      targetFile
    };
  }
}