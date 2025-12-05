import { env, pipeline } from "@huggingface/transformers";


console.log('[Worker] Initializing transformerWorker...');
console.log('navigator.gpu in worker?', 'gpu' in navigator ? 'yes' : 'no');

if (env?.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency
  ? Math.max(1, Math.min(4, navigator.hardwareConcurrency - 1))
  : 2;
  const bundledPath = typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL('transformers/')
    : new URL('../transformers/', self.location.href).toString();
  env.backends.onnx.wasm.wasmPaths = bundledPath;
  console.log('[Worker] Set wasmPaths to:', bundledPath);
} else {
  console.warn('[Worker] Could not configure wasmPaths: wasm backend missing?');
}

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.useBrowserCache = false;
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
        progress_callback: (p: any) => {
          const percentage =
            p.loaded && p.total ? Math.round((p.loaded / p.total) * 100) : 0;

          postMessage({
            type: 'progress',
            payload: {
              file: p.name || '',
              progress: p.loaded && p.total ? p.loaded / p.total : 0,
            },
          });

          console.log(
            `[Worker] Downloading: ${p.name} ${percentage}%`
          );
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
