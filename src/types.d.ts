// Ambient types for the type check (`npm run types`): the browser extension API is used loosely, so it is typed as `any`.
declare const chrome: any;
// the pages query the DOM loosely (`querySelector(...).focus()`, `.value`): treat any Element as a form-capable element
interface Element { focus(options?: FocusOptions): void; value?: any; files?: any; dataset: DOMStringMap; }
