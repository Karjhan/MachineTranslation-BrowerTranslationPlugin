import React, { useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { TransformerController } from '../workers/transformerController';
import './App.css';
import { ProgressBar } from '@/components/ProgressBar/ProgressBar';
import ModelSelector from '@/components/ModelSelector/ModelSelector';

const MAX_WORDS_PER_CHUNK = 400;

const MODELS = [
  'Xenova/nllb-200-distilled-600M',
  'aronlp/NLLB-rup-ron-eng-ct2',
];

type LangOption = { label: string; value: string };

const MODEL_LANG_OPTIONS: Record<string, { src: LangOption[]; tgt: LangOption[] }> = {
  'aronlp/NLLB-rup-ron-eng-ct2': {
    src: [
      { label: 'English', value: 'eng_Latn' },
      { label: 'Romanian', value: 'ron_Latn' },
      { label: 'Aromanian', value: 'rup_Latn' },
    ],
    tgt: [
      { label: 'English', value: 'eng_Latn' },
      { label: 'Romanian', value: 'ron_Latn' },
      { label: 'Aromanian', value: 'rup_Latn' },
    ],
  },
  'Xenova/nllb-200-distilled-600M': {
    src: [
      { label: 'English', value: 'eng_Latn' },
      { label: 'French', value: 'fra_Latn' },
      { label: 'Italian', value: 'ita_Latn' },
      { label: 'German', value: 'deu_Latn' },
      { label: 'Spanish', value: 'spa_Latn' },
    ],
    tgt: [
      { label: 'English', value: 'eng_Latn' },
      { label: 'French', value: 'fra_Latn' },
      { label: 'Italian', value: 'ita_Latn' },
      { label: 'German', value: 'deu_Latn' },
      { label: 'Spanish', value: 'spa_Latn' },
    ],
  },
};

const DEFAULT_LANGS: Record<string, { src: string; tgt: string }> = {
  'aronlp/NLLB-rup-ron-eng-ct2': { src: 'eng_Latn', tgt: 'rup_Latn' },
  'Xenova/nllb-200-distilled-600M': { src: 'eng_Latn', tgt: 'fra_Latn' },
};

const App: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [srcLang, setSrcLang] = useState(DEFAULT_LANGS[MODELS[0]].src);
  const [tgtLang, setTgtLang] = useState(DEFAULT_LANGS[MODELS[0]].tgt);

  const controllerRef = React.useRef<TransformerController | null>(null);
  if (!controllerRef.current) controllerRef.current = new TransformerController();
  const controller = controllerRef.current;

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    const def = DEFAULT_LANGS[model] ?? { src: 'eng_Latn', tgt: 'fra_Latn' };
    setSrcLang(def.src);
    setTgtLang(def.tgt);
  };

  async function getVisibleTextNodesFromActiveTab(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      getActiveTabId().then((tabId) => {
        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: () => {
              const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                  if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
                  if (node.parentElement && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) {
                    return NodeFilter.FILTER_REJECT;
                  }
                  return NodeFilter.FILTER_ACCEPT;
                }
              });

              const texts: string[] = [];
              while (walker.nextNode()) {
                texts.push(walker.currentNode!.textContent!);
              }
              return texts;
            }
          },
          (results) => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError.message);
            if (!results || results.length === 0) return reject('No results from page script');
            resolve(results[0].result!);
          }
        );
      }).catch(reject);
    });
  }

  async function getActiveTabId(): Promise<number> {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return reject('No active tab found');
        resolve(tabs[0].id!);
      });
    });
  }

  async function replaceVisibleTextNodes(tabId: number, translations: string[]) {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (translatedTexts: string[]) => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
            if (node.parentElement && ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.parentElement.tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        });

        let i = 0;
        while (walker.nextNode()) {
          if (i < translatedTexts.length) {
            walker.currentNode!.textContent = translatedTexts[i++];
          }
        }
      },
      args: [translations],
    });
  }

  function chunkText(text: string, maxWords: number): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += maxWords) {
      chunks.push(words.slice(i, i + maxWords).join(' '));
    }
    return chunks;
  }

  const handleTranslate = async () => {
    setIsTranslating(true);
    setProgress({ current: 0, total: 0 });

    controller.onProgress((current, total) => {
      setProgress({ current, total });
    });

    const task =
      selectedModel === 'Xenova/nllb-200-distilled-600M'
        ? 'translation'
        : 'text2text-generation';

    try {
      await controller.initialize(selectedModel, task);

      const tabId = await getActiveTabId();

      const pageTexts = await getVisibleTextNodesFromActiveTab();

      const chunks: string[] = [];
      const chunkCountsPerText: number[] = [];

      for (const text of pageTexts) {
        const textChunks = chunkText(text, MAX_WORDS_PER_CHUNK);
        chunkCountsPerText.push(textChunks.length);
        chunks.push(...textChunks);
      }

      if (srcLang === tgtLang) {
        console.warn('Source and target language are the same. Skipping translation.');
        await replaceVisibleTextNodes(tabId, pageTexts);
        return;
      }
      const translatedChunks = await controller.translate(chunks, srcLang, tgtLang);

      const translatedPerText: string[] = [];
      let offset = 0;

      for (const count of chunkCountsPerText) {
        translatedPerText.push(translatedChunks.slice(offset, offset + count).join(' '));
        offset += count;
      }

      await replaceVisibleTextNodes(tabId, translatedPerText);
    } catch (err) {
      console.error('[Translation Error]', err);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <Container className="app-container">
      <Row className="first-row mt-2">
        <Col xs={4}>
          <img src="/AI-GIF.gif" alt="AI" className="ai-logo" />
        </Col>
        <Col xs={8}>
          <h5 className="title">AI Page Translator</h5>
        </Col>
      </Row>

      <Row className="mb-2">
        <Col>
          <ModelSelector
            selectedModel={selectedModel}
            models={MODELS}
            onModelChange={handleModelChange}
            onTranslate={handleTranslate}
            loading={isTranslating}
            srcLang={srcLang}
            tgtLang={tgtLang}
            onSrcLangChange={setSrcLang}
            onTgtLangChange={setTgtLang}
            langOptions={MODEL_LANG_OPTIONS[selectedModel]}
          />
        </Col>
      </Row>

      {isTranslating && (
        <Row>
          <Col>
            <ProgressBar current={progress.current} total={progress.total} />
          </Col>
        </Row>
      )}
    </Container>
  );
};

export default App;
