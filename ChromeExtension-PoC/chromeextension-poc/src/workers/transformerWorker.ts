import { env, pipeline } from "@huggingface/transformers";
const _fetch = globalThis.fetch;

globalThis.fetch = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : "url" in input
      ? input.url
      : "";

  const res = await _fetch(input, init);

  if (url.includes(".onnx") || url.includes(".onnx_data")) {
    try {
      const clone = res.clone();
      const buf = await clone.arrayBuffer();
      const head = Array.from(new Uint8Array(buf.slice(0, 16)));
      console.log(
        "[FETCH]",
        url,
        "status",
        res.status,
        "bytes",
        buf.byteLength,
        "head",
        head
      );
    } catch (e) {
      console.warn("[FETCH] failed to inspect", url, e);
    }
  }

  return res;
};

function firstTokenId(encoded: any): number {
  const ids = encoded?.input_ids;
  const data = ids?.data ?? ids?.ort_tensor?.data;
  if (data && data.length > 0) return Number(data[0]);
  if (Array.isArray(ids) || ArrayBuffer.isView(ids)) return Number((ids as any)[0]);
  throw new Error("Can't extract token id");
}

async function getLangTokenId(tokenizer: any, lang: string): Promise<number> {
  if (typeof tokenizer.encode === "function") {
    const enc = await tokenizer.encode(lang);
    if (Array.isArray(enc) && enc.length > 1) return Number(enc[1]);
  }
  const enc2 = await tokenizer(lang, { add_special_tokens: false });
  return firstTokenId(enc2);
}

function getTensorData(t: any): any | null {
  if (!t) return null;
  if (t.data && ArrayBuffer.isView(t.data)) return t.data;
  if (t.ort_tensor?.data && ArrayBuffer.isView(t.ort_tensor.data)) return t.ort_tensor.data;
  return null;
}

function setFirstToken(t: any, id: number) {
  const d = getTensorData(t);
  if (!d || d.length === 0) return false;
  (d as any)[0] = typeof (d as any)[0] === "bigint" ? BigInt(id) : id;
  return true;
}

console.log('[Worker] Initializing transformerWorker...');
console.log('navigator.gpu in worker?', 'gpu' in navigator ? 'yes' : 'no');

if (env?.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.proxy = false;
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

console.log('[Worker] env configuration completed.');

let translator: any = null;

onmessage = async (e) => {
  const { type, payload } = e.data;
  console.log(`[Worker] Received message: ${type}`, payload);

  if (type === 'init') {
    const { model, task, wasmPath, modelPath } = payload;
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.useBrowserCache = false;
    env.localModelPath = modelPath; 

    try {
      if (env?.backends?.onnx?.wasm && wasmPath) {
        env.backends.onnx.wasm.wasmPaths = wasmPath;
        console.log('[Worker] Overriding wasmPaths with payload path:', wasmPath);
      }

      const testUrl = `${env.localModelPath}${model}/onnx/encoder_model.onnx`;
      const r = await fetch(testUrl);
      console.log("[Worker] ONNX test fetch:", testUrl, r.status, r.headers.get("content-type"));
      const buf = await r.arrayBuffer();
      const head = Array.from(new Uint8Array(buf.slice(0, 16)));
      console.log("[Worker] ONNX first bytes:", head);

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
      const msg = err?.message ?? (typeof err === 'string' ? err : JSON.stringify(err));
      postMessage({ type: 'error', payload: msg });
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

        const tok = translator.tokenizer;
        console.log("model config forced_bos:", translator.model.config.forced_bos_token_id);
        console.log("model config decoder_start:", translator.model.config.decoder_start_token_id);
        console.log("tok src_lang:", tok.src_lang, "tok tgt_lang:", tok.tgt_lang);
        console.log("special tokens:", tok.special_tokens_map ?? null);

        const inputs = await tok(text, {
          src_lang,
          padding: true,
          truncation: true,
          return_tensors: "np",
        });
        
        const srcId = await getLangTokenId(tok, src_lang);
        setFirstToken(inputs.input_ids, srcId);
        console.log("forced SRC token:", srcId, tok.decode([srcId]));

        const ids = inputs.input_ids?.data ?? inputs.input_ids?.ort_tensor?.data;
        console.log("input_ids head:", Array.from(ids).slice(0, 10));
        const headIds = Array.from(ids).slice(0, 40).map(Number);
        console.log("INPUT decoded head:", tok.decode(headIds));

        const forcedBos = await getLangTokenId(tok, tgt_lang);
        console.log("forcedBos:", forcedBos, "decoded:", tok.decode([forcedBos]));
        translator.model.config.decoder_start_token_id = forcedBos;
        translator.model.generation_config.decoder_start_token_id = forcedBos;
        translator.model.config.forced_bos_token_id = forcedBos;
        translator.model.generation_config.forced_bos_token_id = forcedBos;

        const out = await translator.model.generate({
          ...inputs,

          // HF’s canonical way for NLLB: force BOS to target lang token
          forced_bos_token_id: forcedBos,

          num_beams: 4,
          max_new_tokens: 128,
          min_new_tokens: 10,

          // Make sure these are set (some converted configs miss them)
          eos_token_id: tok.eos_token_id ?? 2,
          pad_token_id: tok.pad_token_id ?? 1,

          // OPTIONAL anti-garbage:
          repetition_penalty: 1.1,
          no_repeat_ngram_size: 3,
        });

        // ---- decode ----
        const out0 = Array.isArray(out) ? out[0] : out;
        const data = getTensorData(out0);
        const dims = out0?.dims;

        let tokenIds: number[] = [];
        if (data && dims?.length === 2) {
          const seqLen = dims[1];
          tokenIds = Array.from(data as any).slice(0, seqLen).map(Number);
        } else if (data) {
          tokenIds = Array.from(data as any).map(Number);
        }

        // Trim leading decoder-start EOS if present, and cut at first EOS after that:
        const eos = tok.eos_token_id ?? 2;
        if (tokenIds[0] === eos) tokenIds = tokenIds.slice(1);
        const eosPos = tokenIds.indexOf(eos);
        if (eosPos !== -1) tokenIds = tokenIds.slice(0, eosPos + 1);

        console.log("ids head:", tokenIds.slice(0, 30));
        if (typeof tok.convert_ids_to_tokens === "function") {
          console.log("tokens head:", tok.convert_ids_to_tokens(tokenIds.slice(0, 30)));
        }

        const decoded = tok.decode(tokenIds, { skip_special_tokens: true });
        results.push(decoded);

        count++;
        postMessage({ type: "chunk-progress", payload: { current: count, total: texts.length } });
      }

      console.log('[Worker] Translation complete');
      postMessage({ type: 'result', payload: results });
    } catch (err: any) {
      console.error('[Worker] Translation error:', err);
      const msg = err?.message ?? (typeof err === 'string' ? err : JSON.stringify(err));
      postMessage({ type: 'error', payload: msg });
    }
  }
};
