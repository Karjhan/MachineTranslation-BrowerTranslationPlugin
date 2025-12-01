import { pipeline, env } from '@xenova/transformers';

console.log('[Worker] Initializing transformerWorker...');

if (env?.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
  const bundledPath = typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('transformers/')
    : new URL('../transformers/', self.location.href).toString();
  env.backends.onnx.wasm.wasmPaths = bundledPath;
  console.log('[Worker] Set wasmPaths to:', bundledPath);
} else {
  console.warn('[Worker] Could not configure wasmPaths: wasm backend missing?');
}

env.allowLocalModels = true;
env.useBrowserCache = true;
env.localModelPath = '/models';

console.log('[Worker] env configuration completed.');

let translator: any = null;

onmessage = async (e) => {
  const { type, payload } = e.data;
  console.log(`[Worker] Received message: ${type}`, payload);

  if (type === 'init') {
    const { model, task, wasmPath } = payload;

    try {
      if (env?.backends?.onnx?.wasm && wasmPath) {
        env.backends.onnx.wasm.wasmPaths = wasmPath;
        console.log('[Worker] Overriding wasmPaths with payload path:', wasmPath);
      }

      translator = await pipeline(task, model, {
        quantized: true,
        progress_callback: (file: any, progress: any) => {
          postMessage({ type: 'progress', payload: { file, progress } });
          console.log('[Worker] Downloading:', file?.url || file, `${Math.round((progress ?? 0) * 100)}%`);
        }
      });

      console.log('[Worker] Pipeline initialized successfully');
      postMessage({ type: 'ready' });
    } catch (err: any) {
      console.error('[Worker] Failed to initialize pipeline:', err);
      postMessage({ type: 'error', payload: err.message });
    }
  }

  if (type === 'translate') {
    const { texts, src_lang, tgt_lang } = payload;
    if (!translator) {
      console.error('[Worker] Translator not initialized');
      return postMessage({ type: 'error', payload: 'Pipeline not initialized' });
    }

    try {
      const results: string[] = [];
      let count = 0;

      for (const text of texts) {
        console.log(`[Worker] Translating chunk (${count + 1}/${texts.length})`);
        const output = await translator(text, { src_lang, tgt_lang });
        console.log('[Worker] Raw output from translator:', output);
        results.push(output[0].translation_text);

        count++;
        postMessage({ type: 'chunk-progress', payload: { current: count, total: texts.length } });
      }

      console.log('[Worker] Translation complete');
      postMessage({ type: 'result', payload: results });
    } catch (err: any) {
      console.error('[Worker] Translation error:', err);
      postMessage({ type: 'error', payload: err.message });
    }
  }
};
