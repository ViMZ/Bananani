const NETWORK_ERROR = 'La connexion a été interrompue. Réessaie l’import ; ta photo et ta saisie sont conservées.';
const INTERRUPTED_ERROR = 'L’import a été interrompu ou a expiré. Réessaie l’import ; ta saisie est conservée.';
function restartable(message) {
  const error = new Error(message);
  error.restartImport = true;
  return error;
}
const networkFailure = err => ['TypeError', 'TimeoutError', 'AbortError', 'NetworkError'].includes(err?.name)
  || /failed to fetch|load failed|network request failed|networkerror/i.test(err?.message || '');

/** Réutiliser le même id reprend un import sans relancer un OCR déjà démarré. */
export async function importRecipe(file, { id, onPhase = () => {}, fetcher = fetch,
  pause = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now, timeoutMs = 180000 } = {}) {
  const started = now();
  const statusUrl = `/recipes/ocr?job=${encodeURIComponent(id)}`;
  let created = false;
  let uploads = 0;
  let networkFailures = 0;
  let requestFailure = false;
  while (now() - started < timeoutMs) {
    let response, result;
    // Le GET réveille aussi une machine en veille avant l'envoi de la photo.
    try {
      response = await fetcher(statusUrl, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
      if (response.redirected || response.status === 401) throw new Error('Ta session a expiré. Reconnecte-toi pour importer une recette.');
      if (response.status === 404) {
        if (created) throw restartable(INTERRUPTED_ERROR);
        if (uploads >= 2) throw new Error(NETWORK_ERROR);
        onPhase('upload');
        const body = new FormData();
        body.set('image', file);
        uploads++;
        response = await fetcher('/recipes/ocr?mode=async', { method: 'POST', headers: { 'X-Import-Id': id }, body, signal: AbortSignal.timeout(60000) });
        if (response.redirected || response.status === 401) throw new Error('Ta session a expiré. Reconnecte-toi pour importer une recette.');
      }
      try { result = await response.json(); }
      catch { throw new TypeError('Invalid import response'); }
      if (!response.ok) throw new Error(result.error || 'L’import a échoué. Réessaie ; ta saisie est conservée.');
      created = true;
      networkFailures = 0;
      requestFailure = false;
    } catch (err) {
      if (!networkFailure(err)) throw err;
      requestFailure = true;
      networkFailures++;
      if (networkFailures >= 5) throw new Error(NETWORK_ERROR);
      onPhase('reconnecting');
      await pause(1000);
      continue;
    }
    if (result.status === 'complete' && result.result?.recipe && Array.isArray(result.result.ingredients)) return result.result;
    if (result.status === 'error') throw restartable(result.error || 'La lecture a échoué. Essaie une photo plus nette.');
    if (result.status !== 'processing') throw new Error('Le service a renvoyé une réponse inattendue. Réessaie ; ta saisie est conservée.');
    onPhase(result.phase === 'review' ? 'review' : 'ocr');
    await pause(1000);
  }
  throw new Error(requestFailure ? NETWORK_ERROR : 'L’import prend trop de temps. Réessaie pour reprendre son résultat ; ta saisie est conservée.');
}
