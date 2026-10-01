const params = new URLSearchParams(window.location.search);
const domain = params.get('domain') || 'Сайт';
document.getElementById('blockedDomainName').textContent = domain;

document.getElementById('goBackBtn').addEventListener('click', () => {
  window.history.back();
});
document.getElementById('closeTabBtn').addEventListener('click', () => {
  window.close();
});
