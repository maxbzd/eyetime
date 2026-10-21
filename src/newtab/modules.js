// Home-page modules: tasks, habits, notes, quick links. Each returns a card element and manages its own storage.
// One file per module (mod-*.js); this barrel keeps the import path stable.

export { tasksModule } from './mod-tasks.js';
export { habitsModule } from './mod-habits.js';
export { notesModule } from './mod-notes.js';
export { linksModule } from './mod-links.js';
