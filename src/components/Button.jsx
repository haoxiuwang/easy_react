import React from '../miniReact.js';

export default function Button({ onClick, label }) {
  return <button onClick={onClick}>{label}</button>;
}
