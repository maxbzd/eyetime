// What the dock needs from the browser: access to web pages (an optional permission, asked only when the person turns the dock on).
export const DOCK_ORIGINS = ['http://*/*', 'https://*/*'];

// The look of the open panel: 1 Void (typographic), 2 Glass (default), 3 Noir (ivory serif). Anything else falls back to Glass.
export const DOCK_DESIGNS = [1, 2, 3];
export const DOCK_DESIGN_DEFAULT = 2;
export const dockDesign = (d) => (DOCK_DESIGNS.includes(Number(d && d.design)) ? Number(d.design) : DOCK_DESIGN_DEFAULT);
