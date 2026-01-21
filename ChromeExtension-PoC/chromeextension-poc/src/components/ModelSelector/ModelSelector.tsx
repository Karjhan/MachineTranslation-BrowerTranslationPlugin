import React from 'react';
import { Form } from 'react-bootstrap';
import './ModelSelector.css';
import TranslateButton from '../TranslateButton/TranslateButton';

type LangOption = { label: string; value: string };

type Props = {
  selectedModel: string;
  models: string[];
  onModelChange: (model: string) => void;
  onTranslate: () => void;
  loading: boolean;
  srcLang: string;
  tgtLang: string;
  onSrcLangChange: (lang: string) => void;
  onTgtLangChange: (lang: string) => void;
  langOptions: { src: LangOption[]; tgt: LangOption[] };
};

const ModelSelector: React.FC<Props> = ({
  selectedModel,
  models,
  onModelChange,
  onTranslate,
  loading,
  srcLang,
  tgtLang,
  onSrcLangChange,
  onTgtLangChange,
  langOptions,
}) => {
  return (
    <div className="model-selector card shadow-sm">
      <div className="d-flex flex-column gap-2">
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

        <div className="d-flex gap-2">
          <Form.Select
            value={srcLang}
            onChange={(e) => onSrcLangChange(e.target.value)}
            disabled={loading}
          >
            {langOptions.src.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Source: {opt.label}
              </option>
            ))}
          </Form.Select>

          <Form.Select
            value={tgtLang}
            onChange={(e) => onTgtLangChange(e.target.value)}
            disabled={loading}
          >
            {langOptions.tgt.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Target: {opt.label}
              </option>
            ))}
          </Form.Select>
        </div>
      </div>
    </div>
  );
};

export default ModelSelector;
