import React from './miniReact.js';
import App from './App.jsx';

const root = document.getElementById('app');
const app = new React.createElement(App);
root.appendChild(app.render());
