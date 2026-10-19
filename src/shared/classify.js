import { PRESETS, PRESET_IDS, PRODUCTIVE_DEFAULTS } from './catalog.js';
import { matches, matchesAny } from './domains.js';

/**
 * Candidate rules for classification, each { domain, cls, prio }.
 * The most specific (longest) matching domain wins; on a tie the higher priority wins
 * (user override 3 > custom list 2 > built-in 1).
 */
function candidates(settings) {
  const b = settings.blocking;
  const out = [];
  for (const d of PRODUCTIVE_DEFAULTS) out.push({ domain: d, cls: 'productive', prio: 1 });
  for (const id of PRESET_IDS) if (b.presets[id]) for (const d of PRESETS[id].domains) out.push({ domain: d, cls: 'distracting', prio: 1 });
  for (const d of b.custom) out.push({ domain: d, cls: 'distracting', prio: 2 });
  for (const d of b.always) out.push({ domain: d, cls: 'distracting', prio: 2 });
  for (const [d, cls] of Object.entries(settings.sites || {})) out.push({ domain: d, cls, prio: 3 });
  return out;
}

/** Builds a fast classifier for the current settings. Rebuild it when settings change. */
export function makeClassifier(settings) {
  const rules = candidates(settings);
  const allow = settings.blocking.allow;
  const cache = new Map();
  function rule(host) {
    if (!host) return null;
    let best = null;
    for (const r of rules) {
      if (!matches(host, r.domain)) continue;
      if (!best || r.domain.length > best.domain.length || (r.domain.length === best.domain.length && r.prio > best.prio)) best = r;
    }
    return best;
  }
  return {
    /** 'productive' | 'neutral' | 'distracting' */
    classify(host) {
      if (cache.has(host)) return cache.get(host);
      const r = rule(host);
      let cls = r ? r.cls : 'neutral';
      // the allow-list means "never treat as a distraction" (a user override to distracting still wins)
      if (cls === 'distracting' && matchesAny(host, allow) && !(r && r.prio === 3)) cls = 'neutral';
      cache.set(host, cls);
      return cls;
    },
    /** The rule domain responsible for the class (used as the key for "continue" passes and limits). */
    ruleDomain(host) { const r = rule(host); return r ? r.domain : host; },
  };
}
