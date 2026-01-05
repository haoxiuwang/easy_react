import React, { useState, useEffect, createContext, useContext } from './miniReact.js';
import Counter from './components/Counter.jsx';
import Button from './components/Button.jsx';

// Context 示例
const CountContext = createContext(0);

export default function App() {
  const [globalCount, setGlobalCount] = useState(100);

  return (
    <CountContext.Provider value={globalCount}>
      <div>
        <h1>Mini React Demo</h1>
        <p>Global Count: {globalCount}</p>
        <Button label="Increase Global" onClick={() => setGlobalCount(c => c + 1)} />
        <Counter />
      </div>
    </CountContext.Provider>
  );
}
