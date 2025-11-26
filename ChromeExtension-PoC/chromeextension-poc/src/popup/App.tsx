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

  const handleTranslate = async () => {
    setIsTranslating(true);
    setProgress({ current: 0, total: 0 });

    controller.onProgress((current, total) => {
      setProgress({ current, total });
    });

    controller.initialize(selectedModel, 'translation');

    const pageText = document.body.innerText;
    const chunks = chunkText(pageText, 400);

    try {
      const results = await controller.translate(chunks, 'auto', 'eng_Latn');
      const fullTranslation = results.join(' ');
      document.body.innerText = fullTranslation;
    } catch (err) {
      console.error('[Translation Error]', err);
    }

    setIsTranslating(false);
  };

  return (
    <Container className="app-container">
      <Row className="first-row">
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
