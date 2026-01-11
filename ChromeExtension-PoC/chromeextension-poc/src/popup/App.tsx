import React, { useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { TransformerController } from '../workers/transformerController';
import './App.css';
import { ProgressBar } from '@/components/ProgressBar/ProgressBar';
import ModelSelector from '@/components/ModelSelector/ModelSelector';

const MODELS = [
  'Xenova/nllb-200-distilled-600M',
  'aronlp/NLLB-rup-ron-eng-ct2',
];

const MODEL_LANG_CONFIG: Record<string, { src: string; tgt: string }> = {
  'Xenova/nllb-200-distilled-600M': {
    src: 'eng_Latn',
    tgt: 'fra_Latn',
  },
  'aronlp/NLLB-rup-ron-eng-ct2': {
    src: 'eng_Latn',   
    tgt: 'rup_Latn',   
  }
};


const App: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const controllerRef = React.useRef<TransformerController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new TransformerController();
  }
  const controller = controllerRef.current;

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
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

  const handleTranslate = async () => {
    setIsTranslating(true);
    setProgress({ current: 0, total: 0 });

    controller.onProgress((current, total) => {
      setProgress({ current, total });
    });

    await controller.initialize(selectedModel, 'translation');

    try {
      const tabId = await getActiveTabId();
      const pageTexts = ["Hello world. This is a simple test sentence."];
      const chunks = ["Hello world. This is a simple test sentence."];

      const { src, tgt } = MODEL_LANG_CONFIG[selectedModel];

      const translatedChunks = await controller.translate(chunks, src, tgt);
      console.log("TRANSLATED:", translatedChunks);

      const translatedPerText = [];
      let offset = 0;
      for (const text of pageTexts) {
        const words = text.split(/\s+/).length;
        const numChunks = Math.ceil(words / 400);
        translatedPerText.push(translatedChunks.slice(offset, offset + numChunks).join(' '));
        offset += numChunks;
      }

      await replaceVisibleTextNodes(tabId, translatedPerText);
    } catch (err) {
      console.error('[Translation Error]', err);
    }

    setIsTranslating(false);
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

function chunkText(text: string, maxWords: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '));
  }
  return chunks;
}

export default App;
