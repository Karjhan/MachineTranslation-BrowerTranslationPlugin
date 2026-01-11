import { pipeline, env } from '@xenova/transformers';

console.log('[Worker] Loaded transformers module');

env.useBrowserCache = false;
env.allowLocalModels = false;

const TASKS_BY_MODEL = {
  'Xenova/distilgpt2': 'text-generation',
  'Xenova/TinyLlama-1.1B-Chat-v1.0': 'text-generation',
  'Xenova/Mistral-7B-Instruct-v0.2': 'text-generation',
  'Xenova/nllb-200-distilled-600M': 'translation',
};

function chunkText(text, maxWords = 500) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '));
  }
  return chunks;
}

const LANGUAGE_MAP = {
  english: 'eng_Latn',
  french: 'fra_Latn',
  german: 'deu_Latn',
  spanish: 'spa_Latn',
  italian: 'ita_Latn',
  romanian: 'ron_Latn',
  portuguese: 'por_Latn',
  chinese: 'zho_Hans',
  japanese: 'jpn_Jpan',
  korean: 'kor_Hang',
  russian: 'rus_Cyrl',
  hindi: 'hin_Deva',
  arabic: 'arb_Arab',
};

class ChatPipeline {
  static cache = new Map();

  static async getInstance(task, model) {
    const cacheKey = `${task}::${model}`;
    if (!this.cache.has(cacheKey)) {
      console.log(`[Worker] Initializing pipeline for ${model} (${task})`);
      const instance = await pipeline(task, model, {
        quantized: true,
        device: 'cpu',
        progress_callback: (file, progress) => {
          console.log('[Worker] Loading progress:', file, progress);
          postMessage({ type: 'progress', payload: { file, progress } });
        }
      });
      this.cache.set(cacheKey, instance);
    }
    return this.cache.get(cacheKey);
  }
}

onmessage = async (e) => {
  try {
    const { type, payload } = e.data;
    if (type !== 'generate') return;

    const { conversation, model, mode } = payload;
    const task = mode === 'auto' ? TASKS_BY_MODEL[model] || 'text-generation' : mode;

    const docText = conversation[0]?.role === 'system' ? conversation[0].content : '';
    const question = conversation.at(-1)?.content || '';
    const pipe = await ChatPipeline.getInstance(task, model);

    if (task === 'text-generation') {
      const prompt = `Text:\n${docText}\n\nQuestion: ${question}\nAnswer:`;
      const chunks = chunkText(prompt, 500); 
      console.log('[Worker] Generating from', chunks.length, 'chunks');

      let fullReply = '';
      for (let i = 0; i < chunks.length; i++) {
        postMessage({ type: 'progress', payload: { chunk: i + 1, total: chunks.length } });
        const output = await pipe(chunks[i], { max_new_tokens: 200 });
        const fullText = output?.[0]?.generated_text || '';
        const replyPart = fullText.slice(chunks[i].length).trim();
        fullReply += replyPart + ' ';
      }

      postMessage({ type: 'response', payload: fullReply.trim() });
    } else if (task === 'translation') {
      const sourceText = question || docText;
      const lowerText = sourceText.toLowerCase();
      const matchedLang = Object.keys(LANGUAGE_MAP).find(lang =>
        lowerText.includes(`to ${lang}`)
      );
      const tgt_lang = LANGUAGE_MAP[matchedLang] || 'eng_Latn';
      const src_lang = 'ron_Latn'; 

      const chunks = chunkText(sourceText, 400); 
      console.log(`[Worker] Translating ${chunks.length} chunks...`);

      let translated = '';
      for (let i = 0; i < chunks.length; i++) {
        postMessage({ type: 'progress', payload: { chunk: i + 1, total: chunks.length } });
        const output = await pipe(chunks[i], { src_lang, tgt_lang });
        const translation = output?.[0]?.translation_text || '';
        translated += translation + ' ';
      }

      postMessage({ type: 'response', payload: translated.trim() });
    } else {
      throw new Error(`Unsupported task: ${task}`);
    }

  } catch (err) {
    console.error('[Worker] Error during generation:', err);
    postMessage({ type: 'error', payload: err.message || 'Unknown error' });
  }
};
