// Copies MediaPipe's browser files from the installed library into public/, so the site serves them itself
// (photos never go to Google for body detection). Runs after every install, including on Cloudflare's build.
import { copyFileSync, mkdirSync } from "node:fs";

const from = "node_modules/@mediapipe/tasks-vision/wasm";
const to = "public/mediapipe/wasm";
mkdirSync(to, { recursive: true });
for (const name of ["vision_wasm_internal.js", "vision_wasm_internal.wasm", "vision_wasm_nosimd_internal.js", "vision_wasm_nosimd_internal.wasm"]) {
  copyFileSync(`${from}/${name}`, `${to}/${name}`);
}
console.log("Copied MediaPipe files to", to);

// The background-removal runtime (onnxruntime-web), served by the site as well. See src/lib/cutout.ts.
const ortFrom = "node_modules/onnxruntime-web/dist";
const ortTo = "public/ort";
mkdirSync(ortTo, { recursive: true });
copyFileSync(`${ortFrom}/ort-wasm-simd-threaded.wasm`, `${ortTo}/ort-wasm-simd-threaded.wasm`);
console.log("Copied onnxruntime-web files to", ortTo);
