import { selfModify } from "./core/selfModify.js";

const result = await selfModify({
  targetFile: "./core/logger.js",
  goal: "test self modification",
  transform: (code) => {
    if (code.includes("// test marker")) return code;
    return code + "\n// test marker";
  }
});

console.log(result);