// Spaceboss – Webseite: Kopfleiste beim Scrollen, Bilder groß ansehen, sanftes Einblenden.
(function () {
  'use strict';

  const nav = document.getElementById('nav');
  const solid = () => nav.classList.toggle('solid', scrollY > 40);
  addEventListener('scroll', solid, { passive: true });
  solid();

  // Bilder groß ansehen
  const box = document.getElementById('lightbox');
  const big = box.querySelector('img');
  for (const fig of document.querySelectorAll('[data-full]')) {
    fig.querySelector('.shot').addEventListener('click', () => {
      const img = fig.querySelector('img');
      big.src = fig.dataset.full;
      big.alt = img.alt;
      box.showModal();
    });
  }
  box.addEventListener('click', e => { if (e.target === box || e.target.closest('.lb-close')) box.close(); });

  // Karten und Abschnitte blenden beim Scrollen ein
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const items = document.querySelectorAll('.feature, .card, .boss, .panel, .dl');
    const io = new IntersectionObserver(entries => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach((el, i) => { el.classList.add('reveal'); el.style.transitionDelay = (i % 3) * 80 + 'ms'; io.observe(el); });
  }

  // Unter Linux führt der Knopf oben zum Linux-Download
  const ua = navigator.userAgent;
  if (/Linux/.test(ua) && !/Android/.test(ua)) {
    const get = document.getElementById('get');
    get.href = '#linux';
    get.querySelector('span').textContent = 'Für Linux laden';
    get.querySelector('path').setAttribute('d', 'M11 3h2v10.2l3.6-3.6 1.4 1.4-6 6-6-6 1.4-1.4 3.6 3.6zM4 19h16v2H4z');
  }

  document.getElementById('year').textContent = new Date().getFullYear();
})();
