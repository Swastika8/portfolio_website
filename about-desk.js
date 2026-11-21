(() => {
  const desk = document.documentElement;
  let nextSample;

  function setDeskLight() {
    clearTimeout(nextSample);
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    const angle = (hour - 6) * Math.PI / 12;
    const height = Math.sin(angle);
    const twilight = Math.min(1, Math.max(0, (height + 0.25) / 0.65));
    const daylight = twilight * twilight * (3 - 2 * twilight) * (0.55 + 0.45 * Math.max(0, height));
    desk.style.setProperty('--desk-daylight', daylight.toFixed(4));
    desk.style.setProperty('--desk-sweep', (-Math.cos(angle)).toFixed(4));

    if (!document.hidden) {
      nextSample = setTimeout(setDeskLight, 60000 - now.getSeconds() * 1000 - now.getMilliseconds());
    }
  }

  setDeskLight();
  window.addEventListener('pageshow', setDeskLight);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(nextSample);
    else setDeskLight();
  });
})();

