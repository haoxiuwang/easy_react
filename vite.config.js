import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  server: {
    port: 3000
  },
  esbuild: {
    jsxFactory: 'React.createElement', // 使用我们 miniReact 的 createElement
    jsxFragment: 'React.Fragment'
  }
});
