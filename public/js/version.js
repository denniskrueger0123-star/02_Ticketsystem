// Lade Version und zeige sie in einem eigenen Footer-Element an.
// Nutzt ein dediziertes #app-version-Element statt den ganzen Footer-Text zu
// ersetzen, damit andere Skripte (z.B. project.js) den restlichen Footer-Text
// unabhängig setzen können, ohne die Versionsanzeige zu überschreiben.
(async () => {
  try {
    const data = await api.getVersion();
    document.querySelectorAll('#app-version').forEach((el) => {
      el.textContent = `· v${data.version}`;
    });
  } catch (err) {
    // Fehler beim Laden der Version ignorieren, Anzeige bleibt leer
  }
})();
