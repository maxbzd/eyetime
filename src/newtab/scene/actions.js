// The few things a scene may do when someone clicks it. Only these verbs exist (shared/scene/schema.js ACTIONS); a scene cannot ask for anything else.

import { send } from '../../ui/api.js';
import { getSettings, updateCollection } from '../../shared/storage.js';

/** @param {{ do: string, min?: number, name?: string, to?: number }} a @param {{ id?: string } | undefined} item @param {{ setState: (n: string, to: number) => void }} api */
export async function runAction(a, item, api) {
  if (!a) return;
  if (a.do === 'focus.start') { const s = await getSettings(); await send('focus:start', { minutes: a.min || s.focus.minutes, goal: '', strict: s.focus.strict, scope: s.focus.scope, mode: s.focus.mode }); }
  else if (a.do === 'focus.stop') await send('focus:stop');
  else if (a.do === 'focus.pause') await send('focus:pause');
  else if (a.do === 'focus.resume') await send('focus:resume');
  else if (a.do === 'task.toggle' && item && item.id) await updateCollection('tasks', [], (list) => { const k = list.find((x) => x.id === item.id); if (k) { k.done = true; k.doneAt = Date.now(); k.starred = false; } });
  else if (a.do === 'state.set' && a.name) api.setState(a.name, a.to === 0 ? 0 : 1);
}
