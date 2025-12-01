export class TransformerController {
  private worker: Worker;
  private onProgressCallback: ((current: number, total: number) => void) | null = null;

  constructor() {
    const workerUrl = chrome.runtime.getURL('transformerWorker.js');
    console.log('[Controller] Initializing worker with URL:', workerUrl);
    this.worker = new Worker(new URL('./transformerWorker.ts', import.meta.url), {
      type: 'module'
    });


    this.worker.onerror = (e) => {
      console.error('[Controller] Worker error:', e.message);
    };

    this.worker.onmessageerror = (e) => {
      console.error('[Controller] Worker message error:', e);
    };
  }

  onProgress(callback: (current: number, total: number) => void) {
    this.onProgressCallback = callback;
  }

  initialize(model: string, task: string): Promise<void> {
    const wasmPath = chrome.runtime.getURL('transformers/');
    console.log('[Controller] Sending init to worker:', { model, task, wasmPath });

    return new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => {
        const { type, payload } = e.data;

        if (type === 'ready') {
          console.log('[Controller] Worker is ready');
          resolve();
        } else if (type === 'error') {
          console.error('[Controller] Init error:', payload);
          reject(payload);
        }
      };

      this.worker.postMessage({
        type: 'init',
        payload: { model, task, wasmPath }
      });
    });
  }

  translate(texts: string[], src_lang: string, tgt_lang: string): Promise<string[]> {
    console.log('[Controller] Sending translate to worker:', { texts, src_lang, tgt_lang });

    return new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => {
        const { type, payload } = e.data;

        if (type === 'result') {
          console.log('[Controller] Translation result received');
          resolve(payload);
        } else if (type === 'error') {
          console.error('[Controller] Worker error:', payload);
          reject(payload);
        } else if (type === 'chunk-progress') {
          console.log('[Controller] Chunk progress:', payload);
          if (this.onProgressCallback) {
            this.onProgressCallback(payload.current, payload.total);
          }
        }
      };

      this.worker.postMessage({ type: 'translate', payload: { texts, src_lang, tgt_lang } });
    });
  }
}
