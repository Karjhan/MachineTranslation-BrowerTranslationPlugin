import { pipeline, env } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

let translator: any = null;

onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'init') {
    const { model, task } = payload;
    translator = await pipeline(task, model, {
      quantized: true,
      // @ts-expect-error
      device: 'cpu',
      progress_callback: (file: any, progress: any) => {
        postMessage({ type: 'progress', payload: { file, progress } });
      }
    });
    postMessage({ type: 'ready' });
  }

  if (type === 'translate') {
    const { texts, src_lang, tgt_lang } = payload;
    if (!translator) return postMessage({ type: 'error', payload: 'Pipeline not initialized' });

    try {
      const results = [];
      let count = 0;
      for (const text of texts) {
        const output = await translator(text, { src_lang, tgt_lang });
        results.push(output[0].translation_text);

        count += 1;
        postMessage({
          type: 'chunk-progress',
          payload: { current: count, total: texts.length }
        });
      }

      postMessage({ type: 'result', payload: results });
    } catch (err : any) {
      postMessage({ type: 'error', payload: err.message });
    }
  }
};
