// The "custom" widget: a widget a theme drew with the scene language (nodes, formulas, data). It sits on Home like any other widget (position, size, card skin).

import { mountUi } from './scene/engine.js';
import { runAction } from './scene/actions.js';

export const CUSTOM_DEFS = {
  custom: {
    build(root, api) {
      let inst = null, sig = '';
      const mount = () => {
        const c = api.cfg(), s = JSON.stringify(c.ui);
        if (s === sig && inst) { inst.setParams(c.params); return; }
        sig = s; if (inst) inst.destroy();
        inst = mountUi(root, c.ui, { params: c.params, onAction: runAction });
      };
      mount();
      return { update: mount, destroy: () => { if (inst) inst.destroy(); } };
    },
  },
};
