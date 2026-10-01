// EyeTime — ready-made new tab layouts. Each widget: [type, columns(of 12), config?, style?]
window.EyeTimePresets = [
  {
    id: 'classic', icon: '⚡', name: 'Классика', desc: 'Привычная панель: фокус, привычки, задачи и цели',
    widgets: [['focus', 4], ['leaks', 4], ['habits', 4], ['tasks', 6], ['thoughts', 6], ['goals', 6], ['chart', 6]],
    theme: { accent: '#FF5E0E', bg: 'glow', cards: 'glass', font: 'system', radius: 'normal', width: 'normal', density: 'comfortable', header: 'full', scale: 1 }
  },
  {
    id: 'minimal', icon: '🌿', name: 'Минимализм', desc: 'Только время, поиск и ваши ссылки',
    widgets: [['clock', 12, { h24: true, align: 'center' }, { transparent: true }], ['search', 12, {}, { transparent: true }], ['quicklinks', 12, { title: '', align: 'center', links: [{ name: 'Gmail', url: 'https://mail.google.com' }, { name: 'Calendar', url: 'https://calendar.google.com' }, { name: 'Drive', url: 'https://drive.google.com' }, { name: 'Maps', url: 'https://maps.google.com' }, { name: 'Wikipedia', url: 'https://wikipedia.org' }] }, { transparent: true }], ['quote', 12, { align: 'center' }, { transparent: true }]],
    theme: { accent: '#34D399', bg: 'midnight', cards: 'outline', font: 'rounded', radius: 'round', width: 'narrow', density: 'comfortable', header: 'minimal', scale: 1.1 }
  },
  {
    id: 'deepwork', icon: '🎯', name: 'Глубокая работа', desc: 'Таймеры, главная задача и защита от отвлечений',
    widgets: [['focus', 4], ['pomodoro', 4], ['leaks', 4], ['tasks', 8], ['thoughts', 4], ['eyebreak', 4], ['rules', 4]],
    theme: { flow: 'tidy', accent: '#FF5E0E', bg: 'midnight', cards: 'tinted', font: 'system', radius: 'normal', width: 'normal', density: 'comfortable', header: 'full', scale: 1 }
  },
  {
    id: 'dev', icon: '💻', name: 'Разработчик', desc: 'Помодоро, список дел, заметки и статистика',
    widgets: [['pomodoro', 4], ['todaystats', 4], ['clock', 4, { h24: true, seconds: true }], ['checklist', 4, { title: 'TODO', items: [] }], ['notes', 4, { title: 'Scratchpad', text: '' }], ['quicklinks', 4, { title: 'Links', links: [{ name: 'GitHub', url: 'https://github.com' }, { name: 'MDN', url: 'https://developer.mozilla.org' }, { name: 'Stack Overflow', url: 'https://stackoverflow.com' }] }], ['search', 8], ['worldclocks', 4], ['stopwatch', 4]],
    theme: { accent: '#3B82F6', bg: 'grid', cards: 'flat', font: 'mono', radius: 'sharp', width: 'wide', density: 'compact', header: 'full', scale: 1 }
  },
  {
    id: 'student', icon: '🎓', name: 'Студент', desc: 'Учёба: помодоро, дедлайны, привычки и конспекты',
    widgets: [['pomodoro', 4], ['countdown', 4, { title: 'Экзамен', date: '' }], ['habits', 4], ['checklist', 6, { title: 'Домашние задания', items: [] }], ['notes', 6, { title: 'Конспект', text: '' }], ['water', 4], ['calendar', 4], ['quote', 4]],
    theme: { flow: 'tidy', accent: '#A855F7', bg: 'aurora', cards: 'frosted', cardAlpha: 0.5, font: 'rounded', radius: 'round', width: 'normal', density: 'comfortable', header: 'full', scale: 1 }
  },
  {
    id: 'zen', icon: '🧘', name: 'Дзен', desc: 'Спокойствие: дыхание, цитата и отдых для глаз',
    widgets: [['clock', 12, { h24: true, align: 'center' }, { transparent: true }], ['breathing', 6], ['eyebreak', 6], ['quote', 8], ['water', 4], ['progress', 12]],
    theme: { flow: 'tidy', accent: '#14B8A6', bg: 'ocean', cards: 'frosted', cardAlpha: 0.45, font: 'rounded', radius: 'round', width: 'narrow', density: 'comfortable', header: 'minimal', scale: 1 }
  },
  {
    id: 'morning', icon: '🌅', name: 'Утренний ритуал', desc: 'Привычки, вода, правила дня и план на день',
    widgets: [['clock', 6, { h24: true }, { transparent: true }], ['motto', 6, { text: 'Сегодня — лучший день, чтобы начать.', size: 'm', align: 'left' }, { transparent: true }], ['habits', 4], ['water', 4], ['rules', 4], ['checklist', 6, { title: 'План на день', items: [] }], ['tasks', 6]],
    theme: { flow: 'tidy', accent: '#F59E0B', bg: 'sunset', cards: 'frosted', cardAlpha: 0.5, font: 'serif', radius: 'round', width: 'normal', density: 'comfortable', header: 'full', scale: 1 }
  },
  {
    id: 'dashboard', icon: '🧩', name: 'Панель управления', desc: 'Всё на одном экране: максимум информации',
    widgets: [['clock', 3, { h24: true }], ['todaystats', 3], ['eyebreak', 3], ['progress', 3], ['focus', 4], ['leaks', 4], ['habits', 4], ['tasks', 6], ['chart', 6], ['calendar', 4], ['worldclocks', 4], ['counter', 4], ['goals', 6], ['thoughts', 6]],
    theme: { flow: 'tidy', accent: '#6366F1', bg: 'glow', cards: 'glass', font: 'system', radius: 'normal', width: 'wide', density: 'compact', header: 'full', scale: 0.9 }
  }
];
