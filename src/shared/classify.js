import { PRESETS, PRESET_IDS, PRODUCTIVE_DEFAULTS } from './catalog.js';
import { matches, matchesAny } from './domains.js';
import { guessRules } from './siteguess.js';

/**
 * Candidate rules for classification, each { domain, cls, prio }.
 * The most specific (longest) matching domain wins; on a tie the higher priority wins
 * (user override 3 > custom list 2 > built-in 1).
 */
function candidates(settings, guess) {
  const b = settings.blocking;
  const out = guessRules(guess); // what the on-device model guessed for sites in no list: the weakest rule of all
  for (const d of PRODUCTIVE_DEFAULTS) out.push({ domain: d, cls: 'productive', prio: 1 });
  for (const id of PRESET_IDS) if (b.presets[id]) for (const d of PRESETS[id].domains) out.push({ domain: d, cls: 'distracting', prio: 1 });
  for (const d of b.custom) out.push({ domain: d, cls: 'distracting', prio: 2 });
  for (const d of b.always) out.push({ domain: d, cls: 'distracting', prio: 2 });
  for (const [d, cls] of Object.entries(settings.sites || {})) out.push({ domain: d, cls, prio: 3 });
  return out;
}

/** Builds a fast classifier for the current settings (and, for reports, the saved guesses). Rebuild it when settings change. */
export function makeClassifier(settings, guess = undefined) {
  const rules = candidates(settings, guess);
  const allow = settings.blocking.allow;
  const cache = new Map();
  function rule(host) {
    if (!host) return null;
    let best = null, guess = null;
    for (const r of rules) {
      if (!matches(host, r.domain)) continue;
      if (r.prio === 0) { if (!guess || r.domain.length > guess.domain.length) guess = r; continue; } // a guess only counts when no list or personal choice covers the site
      if (!best || r.domain.length > best.domain.length || (r.domain.length === best.domain.length && r.prio > best.prio)) best = r;
    }
    return best || guess;
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
    /** Is the site in a list or chosen by the person (a guess does not count)? */
    known(host) { const r = rule(host); return !!r && r.prio > 0; },
    /** Is the class of this site only a guess of the on-device model? */
    guessed(host) { const r = rule(host); return !!r && r.prio === 0; },
    /** The rule domain responsible for the class (used as the key for "continue" passes and limits). */
    ruleDomain(host) { const r = rule(host); return r ? r.domain : host; },
  };
}
