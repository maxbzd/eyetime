// Runs the depth model off the page's main thread (so the page stays responsive while it works).
// Everything is local: the engine (ONNX Runtime Web, WebAssembly) and the model (Depth Anything V2 Small, 8-bit) are files of this extension.
//   in:  { id, data: Float32Array (1×3×h×w), w, h }      out: { id, depth: Float32Array (h×w) } or { id, error }

import * as ort from './ort.wasm.min.mjs';

const base = new URL('./', import.meta.url).href;
ort.env.wasm.wasmPaths = base;
ort.env.wasm.numThreads = 1; // threads need a cross-origin-isolated page; one thread is fine for one picture, once
ort.env.wasm.proxy = false;

self.onmessage = async (e) => {
  const { id, data, w, h } = e.data || {};
  try {
    const model = await (await fetch(base + 'depth-anything-v2-small-q8.onnx')).arrayBuffer();
    const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', data, [1, 3, h, w]) });
    const depth = /** @type {Float32Array} */ (out[session.outputNames[0]].data);
    self.postMessage({ id, depth }, [depth.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
