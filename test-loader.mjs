import { createRequire, registerHooks } from "node:module";

globalThis.requestAnimationFrame ??= (cb) => setTimeout(() => cb(performance.now()), 16);
globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);

const requireCjs = createRequire(import.meta.url);
const VIRTUAL_THREE_URL = "file:///__khr3_test_three__/three.mjs";

const identRe = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const reserved = new Set([
  "default", "__esModule", "arguments", "await", "break", "case", "catch", "class", "const",
  "continue", "debugger", "delete", "do", "else", "enum", "eval", "export", "extends", "false",
  "finally", "for", "function", "if", "implements", "import", "in", "instanceof", "interface",
  "let", "new", "null", "package", "private", "protected", "public", "return", "static", "super",
  "switch", "this", "throw", "true", "try", "typeof", "var", "void", "while", "with", "yield",
]);

// Share one Three.js singleton between CJS (`@react-three/fiber`) and ESM (`three/examples/jsm/*`) in Node tests.
const threeCjs = requireCjs("three");
globalThis.__KHR3_THREE_CJS__ = threeCjs;
const keys = Object.keys(threeCjs).filter((k) => identRe.test(k) && !reserved.has(k));
const threeWrapperSource = [
  `const cjs = globalThis.__KHR3_THREE_CJS__;`,
  `export const {\n  ${keys.join(",\n  ")},\n} = cjs;`,
  `export default cjs;`,
].join("\n");

registerHooks({
  resolve(specifier, context, nextResolve) {
    const isCjsRequire = Array.isArray(context.conditions) && context.conditions.includes("require");
    if (!isCjsRequire && specifier === "three" && context.parentURL !== VIRTUAL_THREE_URL) {
      return { url: VIRTUAL_THREE_URL, format: "module", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === VIRTUAL_THREE_URL) {
      return { format: "module", source: threeWrapperSource, shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});
