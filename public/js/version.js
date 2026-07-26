// Lade Version und zeige sie im Footer an
(async () => {
  try {
    const data = await api.getVersion();
    const footers = document.querySelectorAll('.pagefoot');
    footers.forEach((el) => {
      const oldText = el.textContent.trim();
      el.textContent = `${oldText} · v${data.version}`;
    });
  } catch (err) {
    // Fehler beim Laden der Version ignorieren, Footer bleibt unverändert
  }
})();
