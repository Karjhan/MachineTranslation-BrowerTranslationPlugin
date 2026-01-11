import React, { useEffect, useRef, useState } from 'react';
import {
  Card,
  Form,
  Button,
  Spinner,
  ToggleButton,
  ButtonGroup,
  ProgressBar
} from 'react-bootstrap';
import './Chatbot.css';

type Message = { role: 'system' | 'user' | 'assistant'; content: string };

type Props = {
  contextText: string;
};

const Chatbot: React.FC<Props> = ({ contextText }) => {
  const availableModels = [
    'Xenova/distilgpt2',
    'Xenova/TinyLlama-1.1B-Chat-v1.0',
    'Xenova/Mistral-7B-Instruct-v0.2',
    'Xenova/nllb-200-distilled-600M'
  ];

  const [selectedModel, setSelectedModel] = useState(availableModels[0]);
  const [mode, setMode] = useState<'text-generation' | 'translation' | 'auto'>('auto');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ chunk: number; total: number } | null>(null);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (contextText) {
      setMessages([{ role: 'system', content: contextText }]);
    }
  }, [contextText]);

  useEffect(() => {
    const worker = new Worker(new URL('../../utils/chatWorker.js', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'response') {
        setMessages((prev) => [...prev, { role: 'assistant', content: payload }]);
        setLoading(false);
        setProgress(null);
      } else if (type === 'error') {
        setMessages((prev) => [...prev, { role: 'assistant', content: `[Error] ${payload}` }]);
        setLoading(false);
        setProgress(null);
      } else if (type === 'progress') {
        if (payload.chunk && payload.total) {
          setProgress({ chunk: payload.chunk, total: payload.total });
        }
      }
    };

    return () => worker.terminate();
  }, []);

  const sendMessage = () => {
    if (!input.trim() || !workerRef.current) return;

    const userMsg: Message = { role: 'user', content: input.trim() };
    const visibleMessages = messages.filter((msg) => msg.role !== 'system');

    const conversation = contextText
      ? [{ role: 'system', content: contextText }, ...visibleMessages, userMsg]
      : [...visibleMessages, userMsg];

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setProgress(null);

    workerRef.current.postMessage({
      type: 'generate',
      payload: {
        conversation,
        model: selectedModel,
        mode: mode
      }
    });
  };

  return (
    <Card className="chatbot-container">
      <div className="chatbot-topbar">
        <strong>Mode:</strong>
        <ButtonGroup>
          {['auto', 'text-generation', 'translation'].map((value) => (
            <ToggleButton
              key={value}
              id={`mode-${value}`}
              type="radio"
              variant="outline-light"
              name="mode"
              value={value}
              checked={mode === value}
              onChange={(e) => setMode(e.currentTarget.value as any)}
              disabled={loading}
            >
              {value}
            </ToggleButton>
          ))}
        </ButtonGroup>
      </div>

      <Card.Body className="chat-messages scroll-box">
        {messages.filter((msg) => msg.role !== 'system').length === 0 && (
          <div className="text-muted">
            {contextText ? 'Start chatting about the uploaded document.' : 'Ask me anything.'}
          </div>
        )}

        {messages
          .filter((msg) => msg.role !== 'system')
          .map((msg, idx) => (
            <div
              key={idx}
              className={`message-bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}
            >
              {msg.content}
            </div>
          ))}

        {loading && (
          <div className="chatbot-spinner">
            <Spinner animation="border" variant="light" />
          </div>
        )}

        {progress && (
          <div className="chatbot-progressbar">
            <ProgressBar
              now={(progress.chunk / progress.total) * 100}
              label={`Chunk ${progress.chunk} of ${progress.total}`}
              animated
              striped
              variant="info"
            />
          </div>
        )}
      </Card.Body>

      <Card.Footer className="chat-input-area">
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="d-flex gap-2"
        >
          <Form.Select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-25"
            disabled={loading}
          >
            {availableModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </Form.Select>
          <Form.Control
            as="textarea"
            rows={1}
            value={input}
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="chat-input-textarea"
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            variant="primary"
          >
            {loading ? '...' : 'Send'}
          </Button>
        </Form>
      </Card.Footer>
    </Card>
  );
};

export default Chatbot;
