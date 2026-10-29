// The settings fields of the newer widgets, as data (the older ones are written out in widget-panel.js). Each field: { key, type, label, … }.
//   choice: options [values]; labels come from t('wg.v.' + value) unless `labels` says otherwise · toggle · number: min, max · text: max · zone
import { t } from '../shared/i18n.js';
import { HEAT_WEEKS, CLOCK_VIEWS, CLOCK_FACES, DATE_STYLES, YEAR_VIEWS, BREATH_PATTERNS, PHOTO_STYLES, ORB_PALETTES, LABEL_FONTS, QUOTE_CTX } from '../shared/widgets-more.js';

const L = (k) => () => t(k);
export const WIDGET_FIELDS = {
  clock: [{ key: 'view', type: 'choice', label: L('wg.f.view'), options: CLOCK_VIEWS }, { key: 'face', type: 'choice', label: L('wg.f.face'), options: CLOCK_FACES, when: (c) => c.view === 'analog' },
    { key: 'seconds', type: 'toggle', label: L('wg.f.seconds') }, { key: 'zone', type: 'zone', label: L('wg.f.zone') }],
  date: [{ key: 'style', type: 'choice', label: L('wg.f.style'), options: DATE_STYLES }],
  year: [{ key: 'view', type: 'choice', label: L('wg.f.view'), options: YEAR_VIEWS }],
  heat: [{ key: 'weeks', type: 'choice', label: L('wg.f.weeks'), options: HEAT_WEEKS, labels: Object.fromEntries(HEAT_WEEKS.map((w) => [w, String(w)])) }],
  topsites: [{ key: 'n', type: 'number', label: L('wg.f.count'), min: 3, max: 8 }],
  timer: [{ key: 'minutes', type: 'number', label: L('wg.f.minutes'), min: 1, max: 180 }, { key: 'title', type: 'text', label: L('wg.f.title'), max: 40 }],
  todo: [{ key: 'n', type: 'number', label: L('wg.f.count'), min: 3, max: 8 }],
  counter: [{ key: 'title', type: 'text', label: L('wg.f.title'), max: 40 }, { key: 'target', type: 'number', label: L('wg.f.target'), min: 0, max: 99999 }, { key: 'step', type: 'number', label: L('wg.f.step'), min: 1, max: 1000 }],
  month: [{ key: 'weekStart', type: 'choice', label: L('wg.f.weekStart'), options: ['auto', 'mon', 'sun'] }],
  agenda: [{ key: 'n', type: 'number', label: L('wg.f.count'), min: 2, max: 6 }],
  links: [{ key: 'n', type: 'number', label: L('wg.f.count'), min: 4, max: 12 }],
  breath: [{ key: 'pattern', type: 'choice', label: L('wg.f.pattern'), options: BREATH_PATTERNS }],
  water: [{ key: 'goal', type: 'number', label: L('wg.f.goal'), min: 1, max: 30 }],
  quote: [{ key: 'ctx', type: 'choice', label: L('wg.f.context'), options: QUOTE_CTX }, { key: 'look', type: 'choice', label: L('wg.f.look'), options: ['serif', 'sans', 'mono'] }],
  label: [{ key: 'text', type: 'text', label: L('wg.f.text'), max: 80 }, { key: 'font', type: 'choice', label: L('wg.f.font'), options: LABEL_FONTS }, { key: 'weight', type: 'number', label: L('wg.f.weight'), min: 300, max: 800 }, { key: 'align', type: 'choice', label: L('wg.f.align'), options: ['left', 'center', 'right'] }],
  photo: [{ key: 'style', type: 'choice', label: L('wg.f.style'), options: PHOTO_STYLES }, { key: 'text', type: 'text', label: L('wg.f.text'), max: 60 }],
  orb: [{ key: 'palette', type: 'choice', label: L('wg.f.palette'), options: ORB_PALETTES }, { key: 'speed', type: 'choice', label: L('wg.f.speed'), options: ['calm', 'lively'] }],
};
