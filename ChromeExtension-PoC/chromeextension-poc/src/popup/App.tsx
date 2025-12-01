import React, { useState } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { TransformerController } from '../workers/transformerController';
import './App.css';
import { ProgressBar } from '@/components/ProgressBar/ProgressBar';
import ModelSelector from '@/components/ModelSelector/ModelSelector';

const MODELS = ['Xenova/nllb-200-distilled-600M'];

const App: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const controller = new TransformerController();

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
  };

  async function getPageTextFromActiveTab(): Promise<string> {
    return new Promise((resolve, reject) => {
      getActiveTabId().then((tabId) => {
        chrome.scripting.executeScript(
          {
            target: { tabId },
            func: () => document.body.innerText,
          },
          (injectionResults) => {
            if (chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError.message);
            }
            if (!injectionResults || injectionResults.length === 0) {
              return reject('No result from script injection');
            }

            const result = injectionResults[0].result;
            if (typeof result !== 'string') {
              return reject('Script returned non-string result');
            }

            resolve(result);
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

  const handleTranslate = async () => {
    setIsTranslating(true);
    setProgress({ current: 0, total: 0 });

    controller.onProgress((current, total) => {
      setProgress({ current, total });
    });

    await controller.initialize(selectedModel, 'translation');

    const pageText = await getPageTextFromActiveTab();
    const chunks = chunkText(pageText, 400);

    console.log('[App] Chunks to translate:', chunks);


    try {
      const results = await controller.translate(chunks, 'eng_Latn', 'fra_Latn');
      console.log('[App] Translation results:', results);
      const fullTranslation = results.join(' ');
      await chrome.scripting.executeScript({
        target: { tabId: await getActiveTabId() },
        func: (translatedText: string) => {
          document.body.innerText = translatedText;
        },
        args: [fullTranslation]
      });
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
