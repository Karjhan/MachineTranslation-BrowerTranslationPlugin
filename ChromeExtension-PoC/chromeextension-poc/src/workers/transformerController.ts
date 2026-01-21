export class TransformerController {
  private worker: Worker;
  private onProgressCallback: ((current: number, total: number) => void) | null = null;

  constructor() {
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
    const modelPath = chrome.runtime.getURL('models/');

    return new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => {
        const { type, payload } = e.data;

        if (type === 'ready') resolve();
        else if (type === 'error') reject(payload);
        else if (type === 'progress') {
        }
      };

      this.worker.postMessage({
        type: 'init',
        payload: { model, task, wasmPath, modelPath }
      });
    });
  }

  translate(texts: string[], src_lang: string, tgt_lang: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => {
        const { type, payload } = e.data;

        if (type === 'result') resolve(payload);
        else if (type === 'error') reject(payload);
        else if (type === 'chunk-progress' && this.onProgressCallback) {
          this.onProgressCallback(payload.current, payload.total);
        }
      };

      this.worker.postMessage({ type: 'translate', payload: { texts, src_lang, tgt_lang } });
    });
  }
}
