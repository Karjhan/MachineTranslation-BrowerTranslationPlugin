import React from 'react';
import { Button } from 'react-bootstrap';
import './TranslateButton.css';

type Props = {
  onClick: () => void;
  disabled?: boolean;
  isTranslating?: boolean;
};

const TranslateButton: React.FC<Props> = ({ onClick, disabled = false, isTranslating = false }) => {
  return (
    <Button
      className="translate-button"
      onClick={onClick}
      disabled={disabled || isTranslating}
      variant="success"
    >
      {isTranslating ? 'Translating...' : 'Translate'}
    </Button>
  );
};

export default TranslateButton;
