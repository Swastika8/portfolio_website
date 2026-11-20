(() => {
  const desk = document.documentElement;
  let nextChange;

  function setDeskLight() {
    clearTimeout(nextChange);
    const now = new Date();
    const hour = now.getHours();
    const daylight = hour >= 6 && hour < 18;
    desk.dataset.deskLight = daylight ? 'day' : 'night';

    const boundary = new Date(now);
    boundary.setHours(daylight ? 18 : 6, 0, 0, 0);
    if (hour >= 18) boundary.setDate(boundary.getDate() + 1);
    nextChange = setTimeout(setDeskLight, boundary - now);
  }

  setDeskLight();
  window.addEventListener('pageshow', setDeskLight);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') setDeskLight();
  });
})();

