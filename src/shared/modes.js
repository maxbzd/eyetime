// Display name of a focus mode: the person's own name, else the built-in translation, else a neutral label (never a raw i18n key).
import { t } from './i18n.js';

export function modeName(m) {
  if (m && m.name) return m.name;
  const key = 'mode.' + (m && m.id);
  const text = t(key);
  return text === key ? t('mode.new') : text;
}
