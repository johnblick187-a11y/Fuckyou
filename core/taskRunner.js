export function listTasks() {
  return ["analyze", "plan", "execute"];
}

export async function runTask(taskName, input = {}) {
  return {
    ok: true,
    task: taskName,
    input,
    result: "Task executed (stub)"
  };
}