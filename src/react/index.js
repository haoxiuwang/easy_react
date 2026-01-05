// -------------------- Mini React --------------------
let CURRENT_COMPONENT = null;

// -------------------- createElement --------------------
function createElement(tag, props, ...children) {
  props = props || {};
  children = children.flat().map(c => c != null ? c : '');
  if (typeof tag === "string") {
    return new VElement(tag, props, children);
  } else {
    return new Component(tag, props, children);
  }
}

// -------------------- Virtual Element --------------------
class VElement {
  constructor(tag, props, children) {
    this.tag = tag;
    this.props = props;
    this.children = children;
    this.dom = null;
  }

  render() {
    const el = document.createElement(this.tag);

    for (let key in this.props) {
      if (key.startsWith('on') && typeof this.props[key] === 'function') {
        el.addEventListener(key.slice(2).toLowerCase(), this.props[key]);
      } else if (key !== 'children' && key !== 'ref') {
        el[key] = this.props[key];
      }
    }

    if (this.props.ref) this.props.ref.current = el;

    this.children.forEach(child => {
      let node;
      if (child instanceof Component || child instanceof VElement) {
        node = child.render();
      } else {
        node = document.createTextNode(child);
      }
      el.appendChild(node);
    });

    this.dom = el;
    return el;
  }

  // Diff & patch
  patch(newVNode) {
    const el = this.dom;
    if (!el) return newVNode.render(); // 没有原节点，直接渲染

    // 类型不同，替换节点
    if (this.tag !== newVNode.tag) {
      const newEl = newVNode.render();
      el.replaceWith(newEl);
      return newEl;
    }

    // props diff
    const oldProps = this.props;
    const newProps = newVNode.props;
    for (let key in { ...oldProps, ...newProps }) {
      if (key === 'children') continue;
      if (key.startsWith('on')) {
        if (oldProps[key] !== newProps[key]) {
          if (oldProps[key]) el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key]);
          if (newProps[key]) el.addEventListener(key.slice(2).toLowerCase(), newProps[key]);
        }
      } else if (el[key] !== newProps[key]) {
        el[key] = newProps[key];
      }
    }

    // children diff
    const maxLen = Math.max(this.children.length, newVNode.children.length);
    for (let i = 0; i < maxLen; i++) {
      const oldChild = this.children[i];
      const newChild = newVNode.children[i];
      if (!oldChild) {
        el.appendChild(newChild instanceof VElement || newChild instanceof Component ? newChild.render() : document.createTextNode(newChild));
      } else if (!newChild) {
        el.removeChild(oldChild.dom || oldChild);
      } else if ((oldChild instanceof VElement) && (newChild instanceof VElement)) {
        oldChild.patch(newChild);
      } else if (oldChild instanceof Component || newChild instanceof Component || typeof oldChild !== typeof newChild || oldChild !== newChild) {
        const newNode = newChild instanceof VElement || newChild instanceof Component ? newChild.render() : document.createTextNode(newChild);
        el.replaceChild(newNode, oldChild.dom || oldChild);
      }
    }

    newVNode.dom = el;
    return el;
  }
}

// -------------------- Component --------------------
class Component {
  constructor(fn, props, children) {
    this.fn = fn;
    this.props = { ...props, children };
    this.states = [];
    this.stateIndex = 0;
    this.effects = [];
    this.effectIndex = 0;
    this.memos = [];
    this.memoIndex = 0;
    this.callbacks = [];
    this.callbackIndex = 0;
    this.child = null;
    this.dom = null;
    this.contexts = {};
  }

  render() {
    this.stateIndex = 0;
    this.effectIndex = 0;
    this.memoIndex = 0;
    this.callbackIndex = 0;

    CURRENT_COMPONENT = this;
    const newChild = this.fn(this.props);
    let node;
    if (this.child) {
      if (this.child instanceof VElement || this.child instanceof Component) {
        node = this.child.patch(newChild);
      } else {
        node = newChild instanceof VElement || newChild instanceof Component ? newChild.render() : document.createTextNode(newChild);
      }
    } else {
      node = newChild instanceof VElement || newChild instanceof Component ? newChild.render() : document.createTextNode(newChild);
    }

    this.child = newChild;
    this.dom = node;

    // 执行 effect
    this.effects.forEach(([fn, deps, cleanup, hasChanged], i) => {
      if (hasChanged) {
        if (cleanup) cleanup();
        const newCleanup = fn();
        this.effects[i][2] = newCleanup;
        this.effects[i][3] = true;
      }
    });

    return node;
  }

  refresh() {
    if (!this.dom || !this.dom.parentNode) return;
    this.render();
  }
}

// -------------------- Hooks --------------------
function useState(initial) {
  const comp = CURRENT_COMPONENT;
  const idx = comp.stateIndex++;
  if (comp.states[idx] === undefined) comp.states[idx] = initial;

  const setState = (newValue) => {
    if (typeof newValue === 'function') newValue = newValue(comp.states[idx]);
    if (newValue === comp.states[idx]) return;
    comp.states[idx] = newValue;
    comp.refresh();
  };

  return [comp.states[idx], setState];
}

function useRef(initial) {
  return useState({ current: initial })[0];
}

function useEffect(fn, deps = []) {
  const comp = CURRENT_COMPONENT;
  const idx = comp.effectIndex++;
  const prev = comp.effects[idx];
  let hasChanged = true;

  if (prev) {
    const [, prevDeps] = prev;
    hasChanged = !deps || deps.some((d, i) => d !== prevDeps[i]);
  }

  if (!prev) {
    comp.effects[idx] = [fn, deps, null, true];
  } else {
    comp.effects[idx] = [fn, deps, prev[2], hasChanged];
  }
}

function useMemo(fn, deps = []) {
  const comp = CURRENT_COMPONENT;
  const idx = comp.memoIndex++;
  const prev = comp.memos[idx];
  if (prev && deps.every((d, i) => d === prev[1][i])) return prev[0];
  const value = fn();
  comp.memos[idx] = [value, deps];
  return value;
}

function useCallback(fn, deps = []) {
  const comp = CURRENT_COMPONENT;
  const idx = comp.callbackIndex++;
  const prev = comp.callbacks[idx];
  if (prev && deps.every((d, i) => d === prev[1][i])) return prev[0];
  comp.callbacks[idx] = [fn, deps];
  return fn;
}

// -------------------- Context --------------------
function createContext(defaultValue) {
  const context = { value: defaultValue, subscribers: new Set() };

  function Provider({ value, children }) {
    context.value = value;
    context.subscribers.forEach(fn => fn(value));
    return children;
  }

  function useContext() {
    const comp = CURRENT_COMPONENT;
    const [state, setState] = useState(context.value);
    context.subscribers.add(setState);
    return state;
  }

  return { Provider, useContext };
}

// -------------------- memo --------------------
function memo(ComponentFn) {
  return function Memoized(props) {
    const comp = CURRENT_COMPONENT;
    comp.memos = comp.memos || [];
    const key = props.key || Symbol();
    const cached = comp.memos.find(([k]) => k === key);
    if (cached) return cached[1];
    const element = new Component(ComponentFn, props);
    comp.memos.push([key, element]);
    return element;
 import { useState } from "react"

// -------------------- useReducer --------------------
function useReducer(reducer,init){
    const [ctx] = useState(init?init:{})
    const [_,refresh] = useState(false)
    ctx.refresh = ()=>{refresh(_=>!_)}
    ctx.refreshAsync = ()=>{
        setTimeout(()=>{ctx.refresh()})
    }
    ctx.dispatch = async (action)=>{
        await reducer(ctx,action)
        ctx.refresh()
    }
    ctx._dispatch = async (action)=>{
        await reducer(ctx,action)        
    }
    return ctx
} };
}

// -------------------- Export --------------------
export default { createElement };
export { useState, useEffect, useRef, useMemo, useCallback, memo, createContext, useReducer };
