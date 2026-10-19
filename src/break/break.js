import { bootPage } from '../ui/page.js';
import { $ } from '../ui/dom.js';
import { send } from '../ui/api.js';
import { t } from '../shared/i18n.js';

(async function main() {
  const s = await bootPage();
  const total = s.eye.breakSeconds || 20;
  const C = 565.5;
  let left = total, finished = false;
  const bar = $('#bar');
  const paint = () => {
    $('#count').textContent = String(left);
    bar.style.strokeDashoffset = String(C * (1 - left / total));
    if (!finished) {
      const blink = left <= Math.min(6, Math.floor(total / 4));
      $('#title').textContent = blink ? t('break.blink') : t('break.look');
      $('#lead').textContent = blink ? t('break.blinkLead') : t('break.lookLead');
    }
  };
  paint();
  const id = setInterval(async () => {
    left--; paint();
    if (left > 0) return;
    clearInterval(id); finished = true;
    $('.stage').classList.add('finished');
    $('#count').textContent = '✓';
    $('#title').textContent = t('break.well'); $('#lead').textContent = t('break.wellLead');
    $('#skip').hidden = true; $('#done').hidden = false;
    await send('break:complete');
  }, 1000);
  $('#skip').addEventListener('click', async () => { clearInterval(id); await send('break:skip'); window.close(); });
  $('#done').addEventListener('click', () => window.close());
})();
