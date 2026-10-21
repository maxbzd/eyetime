// Weekly outcomes: up to three results that would make the week a success (weekly planning is one of the better-supported habits).
// Stored as { week: 'YYYY-MM-DD' (the Monday), items: [{ id, text, done }] }; a new week starts empty.

export const MAX_WEEK_ITEMS = 3;

const pad = (n) => String(n).padStart(2, '0');

/** Day key of the Monday of `date`'s week. */
export function mondayKey(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The items of the plan if it belongs to this week, else []. */
export function itemsFor(plan, key) {
  return plan && plan.week === key && Array.isArray(plan.items) ? plan.items : [];
}

/** New plan after adding a result (trimmed, max 3, max 80 chars). Starts a fresh plan when the stored one is from another week. */
export function addItem(plan, key, text, id = Math.random().toString(36).slice(2, 8)) {
  const items = itemsFor(plan, key);
  const t = String(text || '').trim().slice(0, 80);
  if (!t || items.length >= MAX_WEEK_ITEMS) return { week: key, items };
  return { week: key, items: [...items, { id, text: t, done: false }] };
}

export const toggleItem = (plan, key, id) => ({ week: key, items: itemsFor(plan, key).map((x) => (x.id === id ? { ...x, done: !x.done } : x)) });
export const removeItem = (plan, key, id) => ({ week: key, items: itemsFor(plan, key).filter((x) => x.id !== id) });
export const weekProgress = (plan, key) => { const items = itemsFor(plan, key); return { done: items.filter((x) => x.done).length, total: items.length }; };
