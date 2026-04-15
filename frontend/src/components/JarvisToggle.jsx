import React from 'react';

const JarvisToggle = ({ onClick }) => {
  return (
    <div className="jarvis-container" onClick={onClick}>
      <div className="jarvis-circle"></div>
      <div className="jarvis-circle"></div>
      <div className="jarvis-circle"></div>
      <div className="jarvis-circle"></div>
      <div className="jarvis-circle"></div>
      <div className="jarvis-circle"></div>
      <div className="jarvis-text">JARVIS</div>
    </div>
  );
};

export default JarvisToggle;
