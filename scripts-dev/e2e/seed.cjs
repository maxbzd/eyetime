// Realistic demo data for the store screenshots and the demo video (30 days of browsing, sessions, tasks, habits).

/** Sample texts per language (tasks, habits, if-then plan, palette query) so localized store screenshots do not mix languages. */
const SAMPLES = {
  en: { tasks: ['Write the quarterly report', 'Draft section 2, then the charts', 'Review pull requests', 'Book flights for the conference', 'Send the invoice'], habits: ['Move 20 minutes', 'Read 15 minutes'], then: 'stand up and drink water', query: 'rep' },
  ru: { tasks: ['Написать квартальный отчёт', 'Набросать раздел 2, затем графики', 'Проверить pull request’ы', 'Забронировать билеты на конференцию', 'Отправить счёт'], habits: ['Зарядка 20 минут', 'Чтение 15 минут'], then: 'встать и выпить воды', query: 'отч' },
  es: { tasks: ['Escribir el informe trimestral', 'Redactar la sección 2 y luego los gráficos', 'Revisar pull requests', 'Reservar vuelos para la conferencia', 'Enviar la factura'], habits: ['Moverme 20 minutos', 'Leer 15 minutos'], then: 'levantarme y beber agua', query: 'inf' },
  de: { tasks: ['Quartalsbericht schreiben', 'Abschnitt 2 entwerfen, dann die Diagramme', 'Pull Requests prüfen', 'Flüge zur Konferenz buchen', 'Rechnung senden'], habits: ['20 Minuten Bewegung', '15 Minuten lesen'], then: 'aufstehen und Wasser trinken', query: 'qua' },
  fr: { tasks: ['Rédiger le rapport trimestriel', 'Rédiger la section 2, puis les graphiques', 'Relire les pull requests', 'Réserver les vols pour la conférence', 'Envoyer la facture'], habits: ['Bouger 20 minutes', 'Lire 15 minutes'], then: 'me lever et boire de l’eau', query: 'rap' },
  pt: { tasks: ['Escrever o relatório trimestral', 'Rascunhar a seção 2 e depois os gráficos', 'Revisar pull requests', 'Reservar voos para a conferência', 'Enviar a fatura'], habits: ['Mexer o corpo 20 minutos', 'Ler 15 minutos'], then: 'levantar e beber água', query: 'rel' },
  it: { tasks: ['Scrivere il report trimestrale', 'Abbozzare la sezione 2, poi i grafici', 'Rivedere le pull request', 'Prenotare i voli per la conferenza', 'Inviare la fattura'], habits: ['Muoversi 20 minuti', 'Leggere 15 minuti'], then: 'alzarmi e bere acqua', query: 'rep' },
  pl: { tasks: ['Napisać raport kwartalny', 'Naszkicować sekcję 2, potem wykresy', 'Przejrzeć pull requesty', 'Zarezerwować loty na konferencję', 'Wysłać fakturę'], habits: ['Ruch przez 20 minut', 'Czytanie przez 15 minut'], then: 'wstać i napić się wody', query: 'rap' },
  uk: { tasks: ['Написати квартальний звіт', 'Накидати розділ 2, потім графіки', 'Переглянути pull request’и', 'Забронювати квитки на конференцію', 'Надіслати рахунок'], habits: ['Зарядка 20 хвилин', 'Читання 15 хвилин'], then: 'встати й випити води', query: 'зві' },
  zh: { tasks: ['撰写季度报告', '起草第二部分，然后做图表', '审查 pull request', '预订会议的机票', '发送发票'], habits: ['运动 20 分钟', '阅读 15 分钟'], then: '站起来喝水', query: '报告' },
  ja: { tasks: ['四半期レポートを書く', 'セクション2を下書きして、グラフを作る', 'プルリクエストをレビューする', '会議の航空券を予約する', '請求書を送る'], habits: ['20分体を動かす', '15分読書する'], then: '立ち上がって水を飲む', query: 'レポ' },
};

async function seed(page, { look, mode, background, clockStyle, lang = 'en' }) {
  await page.evaluate(async ([look, mode, background, clockStyle, lang, sample]) => {
    const st = await import('/src/shared/storage.js');
    const { rangeKeys } = await import('/src/shared/time.js');
    await st.updateSettings((s) => {
      s.onboarded = true; s.language = lang; s.focus.dailyGoal = 120; s.blocking.plans = [{ id: 'p', when: '', then: sample.then }];
      Object.assign(s.appearance, { look, mode }); Object.assign(s.newtab, { background, clockStyle });
    });
    await st.setRaw({ gsDismissed: true }); // the first-run checklist is not what a store screenshot is about
    const keys = rangeKeys(30);
    const hosts = ['github.com', 'docs.google.com', 'youtube.com', 'reddit.com', 'news.ycombinator.com'];
    let n = 7; const rnd = () => (n = (n * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < keys.length; i++) {
      await st.updateDay(keys[i], (d) => {
        d.d = {}; d.h = {}; d.ss = []; d.fs = 0; d.fc = 0;
        hosts.forEach((h, k) => { const sec = Math.round((k < 2 ? 0.5 + rnd() : rnd()) * 4800); d.d[h] = sec; const W = [0.5, 1.2, 1.5, 1.1, 0.7, 0.25, 0.8, 1.3, 1.2, 0.9, 0.6, 0.25]; for (let hr = 8; hr < 20; hr++) { (d.h[hr] ||= {})[h] = Math.round((sec / 12) * W[hr - 8] * (0.7 + rnd() * 0.6)); } });
        const c = 1 + Math.floor(rnd() * 3); d.fc = c;
        for (let k = 0; k < c; k++) { const t = new Date(); t.setDate(t.getDate() - (29 - i)); t.setHours(k === 0 ? 9 : k === 1 ? 10 : 15, 5); d.ss.push({ id: 's' + i + k, t: t.getTime(), m: 25 + k * 25, p: 25 + k * 25, g: ['Write the quarterly report', 'Plan the sprint', 'Review pull requests'][k % 3], k: '', tg: ['work', 'study', 'admin'][(i + k) % 3], c: 1, r: 1 + ((i + k) % 3) }); d.fs += (25 + k * 25) * 60; }
        d.b = 2; d.pr = { back: 2, work: 1, bored: 1 }; d.sw = 20 + Math.floor(rnd() * 30); d.fa = Math.floor(rnd() * 4); d.pa = { 'reddit.com': 1 + Math.floor(rnd() * 5), 'youtube.com': Math.floor(rnd() * 4) }; if (i % 3 === 0) d.w = ['Shipped the draft', 'Finished the review', 'Walked every break'][(i / 3 | 0) % 3];
      });
    }
    await st.setCollection('tasks', [
      { id: 'a', text: sample.tasks[0], done: false, starred: true, createdAt: 1, est: 90, focusSec: 4500, resume: sample.tasks[1] },
      { id: 'b', text: sample.tasks[2], done: false, starred: true, createdAt: 2, focusSec: 1500 },
      { id: 'c', text: sample.tasks[3], done: false, starred: false, createdAt: 3 },
      { id: 'd', text: sample.tasks[4], done: true, starred: false, createdAt: 4, focusSec: 900 }]);
    await st.setCollection('habits', { items: [{ id: 'h1', name: sample.habits[0] }, { id: 'h2', name: sample.habits[1] }], log: Object.fromEntries(keys.slice(-5).map((k, i) => [k, i === 4 ? ['h1'] : ['h1', 'h2']])) });
  }, [look, mode, background, clockStyle, lang, SAMPLES[lang] || SAMPLES.en]);
}
module.exports = { seed, SAMPLES };
