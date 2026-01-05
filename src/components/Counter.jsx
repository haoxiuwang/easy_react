import React, { useState } from '../react.js';
import Button from './Button.jsx';

export default function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>Count: {count}</p>
      <Button label="+" onClick={() => setCount(c => c + 1)} />
      <Button label="-" onClick={() => setCount(c => c - 1)} />
    </div>
  );
}
