import React from 'react';
import { Form } from 'react-bootstrap';
import './ModelSelector.css';
import TranslateButton from '../TranslateButton/TranslateButton';

type Props = {
  selectedModel: string;
  models: string[];
  onModelChange: (model: string) => void;
  onTranslate: () => void;
  loading: boolean;
};

const ModelSelector: React.FC<Props> = ({
  selectedModel,
  models,
  onModelChange,
  onTranslate,
  loading
}) => {
  return (
    <div className="model-selector card shadow-sm">
      <div className="d-flex align-items-center justify-content-between gap-2">
        <Form.Select
          className="model-dropdown"
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          disabled={loading}
        >
          {models.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </Form.Select>

        <TranslateButton
          onClick={onTranslate}
          disabled={loading}
          isTranslating={loading}
        />
      </div>
    </div>
  );
};

export default ModelSelector;
