import { env, pipeline } from "@huggingface/transformers";

let translator: any = null;
const translationCache = new Map<string, string>();

function normKey(model: string, src: string, tgt: string, text: string) {
  return `${model}|||${src}|||${tgt}|||${text.replace(/\s+/g, " ").trim()}`;
}

onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === "init") {
    const { model, task, wasmPath, modelPath } = payload;

    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.useBrowserCache = false;
    env.localModelPath = modelPath;

    try {
      if (env?.backends?.onnx?.wasm && wasmPath) {
        env.backends.onnx.wasm.proxy = false;
        env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency
          ? Math.max(1, Math.min(4, navigator.hardwareConcurrency - 1))
          : 2;

        env.backends.onnx.wasm.wasmPaths = wasmPath;
      }

      const pipelineOpts: any = {
        progress_callback: (p: any) => {
          postMessage({
            type: "progress",
            payload: {
              file: p.name || "",
              progress: p.loaded && p.total ? p.loaded / p.total : 0,
            },
          });
        },
      };

      if (model === "aronlp/NLLB-rup-ron-eng-ct2") {
        pipelineOpts.dtype = "int8";
      }

      translator = await pipeline(task, model, pipelineOpts);

      try {
        const tok = translator.tokenizer;
        translator.model.config.pad_token_id = tok?.pad_token_id ?? 1;
        translator.model.config.eos_token_id = tok?.eos_token_id ?? 2;
        translator.model.generation_config.pad_token_id = tok?.pad_token_id ?? 1;
        translator.model.generation_config.eos_token_id = tok?.eos_token_id ?? 2;
      } catch {}

      postMessage({ type: "ready" });
    } catch (err: any) {
      const msg = err?.message ?? (typeof err === "string" ? err : JSON.stringify(err));
      postMessage({ type: "error", payload: msg });
    }
  }

  if (type === "translate") {
    const { texts, src_lang, tgt_lang } = payload;

    if (!translator) {
      return postMessage({ type: "error", payload: "Pipeline not initialized" });
    }

    try {
      const results: string[] = [];

      try {
        translator.tokenizer.src_lang = src_lang;
        translator.tokenizer.tgt_lang = tgt_lang;
      } catch {}

      for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        const key = normKey(translator.model?.config?.name_or_path ?? "", src_lang, tgt_lang, text);

        if (translationCache.has(key)) {
          results.push(translationCache.get(key)!);
          postMessage({ type: "chunk-progress", payload: { current: i + 1, total: texts.length } });
          continue;
        }

        let forcedBos: number | undefined;
        const tok = translator.tokenizer;

        try {
          if (tok?.lang_code_to_id?.[tgt_lang] != null) {
            forcedBos = tok.lang_code_to_id[tgt_lang];
          } else if (typeof tok?.encode === "function") {
            const enc = await tok.encode(tgt_lang);
            forcedBos = Number(enc?.[1] ?? enc?.[0]);
          } else {
            const enc2 = await tok(tgt_lang, { add_special_tokens: false });
            const data = enc2?.input_ids?.data ?? enc2?.input_ids?.ort_tensor?.data;
            forcedBos = data?.length ? Number(data[0]) : undefined;
          }
        } catch {
          forcedBos = undefined;
        }

        const isAronlp = payload?.model === "aronlp/NLLB-rup-ron-eng-ct2"; 
        const numBeams = isAronlp ? 2 : 4;   
        const maxNew = 96;       

        const out = await translator(text, {
          src_lang,
          tgt_lang,
          ...(forcedBos != null ? { forced_bos_token_id: forcedBos } : {}),
          max_new_tokens: maxNew,
          num_beams: numBeams,
        });

        const translated =
          Array.isArray(out)
            ? out[0]?.translation_text ?? out[0]?.generated_text ?? ""
            : out?.translation_text ?? out?.generated_text ?? "";

        translationCache.set(key, translated);
        results.push(translated);

        postMessage({
          type: "chunk-progress",
          payload: { current: i + 1, total: texts.length },
        });
      }

      postMessage({ type: "result", payload: results });
    } catch (err: any) {
      const msg = err?.message ?? (typeof err === "string" ? err : JSON.stringify(err));
      postMessage({ type: "error", payload: msg });
    }
  }
};
