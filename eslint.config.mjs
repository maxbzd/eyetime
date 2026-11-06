// One place for the rules. They are about mistakes (undefined names, unused variables, a name that hides another, == instead of ===, var),
// not about taste: layout is left alone. Every rule is an error: a warning that nobody has to fix stays for ever.

const browser = ['chrome', 'indexedDB', 'window', 'document', 'location', 'localStorage', 'sessionStorage', 'navigator', 'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'URL', 'URLSearchParams', 'Blob', 'Image', 'Intl', 'CSS', 'fetch', 'AbortController', 'TextDecoder', 'TextEncoder', 'MutationObserver', 'history', 'IntersectionObserver',
  'AudioContext', 'self', 'process', 'crypto', 'Response', 'Request', 'structuredClone', 'DOMParser', 'btoa', 'atob', 'CompressionStream', 'DecompressionStream'];

// what the desktop window's screens use on top of that (plain scripts that share `window.ET`; the extension of the desktop app is a module)
const desktop = [...browser, 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle', 'performance', 'ResizeObserver', 'HTMLElement', 'Event', 'KeyboardEvent',
  'PointerEvent', 'MouseEvent', 'CustomEvent', 'devicePixelRatio', 'innerWidth', 'innerHeight', 'Node', 'Element', 'FileReader', 'Path2D', 'OffscreenCanvas', 'ImageData', 'Audio',
  'DOMRect', 'DocumentFragment', 'HTMLCanvasElement', 'XMLSerializer', 'queueMicrotask', 'screen', 'getSelection', 'requestIdleCallback', 'THREE', 'Uint8Array', 'WebSocket', 'addEventListener', 'removeEventListener'];

const rules = {
  'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
  'no-undef': 'error',
  'no-empty': ['error', { allowEmptyCatch: true }],
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'prefer-const': 'error',
  'no-var': 'error',
  'no-shadow': 'error',
  'no-throw-literal': 'error',
  'no-self-compare': 'error',
  'no-unreachable': 'error',
  'no-fallthrough': 'error',
  'no-prototype-builtins': 'error',
  'no-useless-catch': 'error',
  'no-loss-of-precision': 'error',
  'no-unsafe-finally': 'error',
  'no-async-promise-executor': 'error',
  'no-return-assign': 'error',
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'no-script-url': 'error',
};

export default [
  { ignores: ['src/newtab/ml/**', 'desktop/prototype/brands-all.js', 'desktop/prototype/vendor/**'] }, // third-party engine (minified ONNX Runtime Web), not ours to lint
  { files: ['**/*.js', '**/*.mjs'], languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: Object.fromEntries(browser.map((g) => [g, 'readonly'])) }, rules },
  // the paint-before-first-render script is a classic script kept in the oldest syntax on purpose: it must parse and run before anything else on every page
  { files: ['src/ui/theme-init.js'], rules: { 'no-var': 'off' } },
  // the desktop window's screens came from a design prototype and still carry unused names and names that hide others; the rules that find real mistakes apply to them in full
  { files: ['desktop/prototype/**/*.js'], languageOptions: { sourceType: 'script', globals: Object.fromEntries(desktop.map((g) => [g, 'readonly'])) }, rules: { 'no-unused-vars': 'off', 'prefer-const': 'off', 'no-shadow': 'off' } },
  { files: ['desktop/extension/*.js'], languageOptions: { globals: Object.fromEntries(desktop.map((g) => [g, 'readonly'])) }, rules: { 'no-unused-vars': 'off', 'prefer-const': 'off', 'no-shadow': 'off' } },
];
