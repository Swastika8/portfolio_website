if ('serviceWorker' in navigator) {
  const register = () => navigator.serviceWorker.register('/portfolio-worker.js', { type: 'module' }).catch(() => {});
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
