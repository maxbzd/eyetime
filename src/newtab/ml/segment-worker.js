// Runs the subject-segmentation model off the page's main thread (so the page stays responsive while it works).
// Everything is local: the engine (ONNX Runtime Web, WebAssembly) and the model (U²-Net small) are files of this extension.
//   in:  { id, data: Float32Array (1×3×size×size), size }      out: { id, mask: Float32Array (size×size) } or { id, error }

import * as ort from './ort.wasm.min.mjs';

const base = new URL('./', import.meta.url).href;
ort.env.wasm.wasmPaths = base;
ort.env.wasm.numThreads = 1; // threads need a cross-origin-isolated page; one thread is plenty for a 320 px input
ort.env.wasm.proxy = false;

let session = null;

self.onmessage = async (e) => {
  const { id, data, size } = e.data || {};
  try {
    if (!session) {
      const model = await (await fetch(base + 'u2netp.onnx')).arrayBuffer();
      session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
    }
    const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', data, [1, 3, size, size]) });
    const mask = /** @type {Float32Array} */ (out[session.outputNames[0]].data);
    self.postMessage({ id, mask }, [mask.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
