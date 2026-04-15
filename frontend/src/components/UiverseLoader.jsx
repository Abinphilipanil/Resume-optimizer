import React from 'react';

const UiverseLoader = () => {
  const letters = "Generating".split("");
  
  return (
    <div className="loader-wrapper">
      {letters.map((letter, index) => (
        <span 
          key={index} 
          className="loader-letter" 
          style={{ animationDelay: `${index * 0.1}s` }}
        >
          {letter}
        </span>
      ))}
      <div className="loader"></div>
    </div>
  );
};

export default UiverseLoader;
