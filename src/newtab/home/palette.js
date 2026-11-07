// SPDX-License-Identifier: FSL-1.1-ALv2
// Copyright 2026 maxbzd
// The commands Home adds to the command palette (Ctrl/Cmd+K): night clock, plan the day, close the day, arrange, surprise me, customize.

import { t } from '../../shared/i18n.js';
import { updateSettings } from '../../shared/storage.js';
import { installPalette } from '../../ui/palette.js';
import { surprise } from '../../shared/starters.js';
import { openShutdown } from '../shutdown.js';
import { openDayPlan } from '../dayplan.js';
import { applyStarterWith } from '../starter-panel.js';
import { home } from '../home-config.js';
import { openDrawer, openEditor } from './drawer.js';
import { openTour } from './tour.js';

const set = (fn) => updateSettings((x) => { fn({ ...x, newtab: home(x) }); }); // edits go to the layout in use

export function installHomePalette() {
  installPalette({ extra: () => [
    { group: 'go', icon: 'moon', label: t('sb.now'), run: () => window.dispatchEvent(new window.CustomEvent('et:standby')), keys: ['night', 'clock', 'standby', 'sleep'] },
    { group: 'focus', icon: 'calendar-clock', label: t('plan.title'), run: openDayPlan, keys: ['plan', 'schedule', 'day', 'blocks'] },
    { group: 'go', icon: 'moon', label: t('sc.closeDay'), run: openShutdown, keys: ['shutdown', 'review', 'plan tomorrow'] },
    { group: 'go', icon: 'move', label: t('cv.edit'), run: openEditor, keys: ['arrange', 'move', 'drag', 'layout', 'widgets'] },
    { group: 'go', icon: 'dices', label: t('st.surprise'), run: () => applyStarterWith(set, surprise(), t('st.surprise')), keys: ['surprise', 'random', 'theme', 'shuffle'] },
    { group: 'go', icon: 'sliders-horizontal', label: t('tour.open'), run: () => openTour(), keys: ['guided', 'guide', 'setup', 'set up', 'tour', 'tips', 'help', 'start', 'onboarding', 'настройка', 'подробная'] },
    { group: 'go', icon: 'sliders-horizontal', label: t('sc.customize'), run: openDrawer, keys: ['customize', 'layout', 'background', 'clock'] },
  ] });
}
