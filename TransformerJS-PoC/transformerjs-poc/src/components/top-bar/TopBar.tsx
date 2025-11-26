import React from 'react';
import './TopBar.css';

const TopBar: React.FC = () => {
  return (
    <div className="top-bar">
      <div className="top-bar-content">
        <img src="/transformer.gif" alt="Logo" className="top-bar-logo" />
        <h1 className="top-bar-title">TransformerJS-PoC</h1>
      </div>
    </div>
  );
};

export default TopBar;
