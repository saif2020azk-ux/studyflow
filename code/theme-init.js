// Apply the saved preference before styles load to avoid a light flash in dark mode.
(() => {
  let preference;
  try { preference = localStorage.getItem('studyflow.theme'); } catch {}
  const theme = ['light', 'dark'].includes(preference)
    ? preference
    : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
