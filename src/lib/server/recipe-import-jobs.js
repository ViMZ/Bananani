/** Résultats temporaires : aucune photo ni recette n'est enregistrée en base. */
export function createImportJobs({ now = Date.now, ttlMs = 10 * 60 * 1000, maxEntries = 40, maxActive = 1 } = {}) {
  const jobs = new Map();
  const key = (userId, id) => `${userId}:${id}`;
  const snapshot = job => job.status === 'complete' ? { status: 'complete', result: job.result }
    : job.status === 'error' ? { status: 'error', error: job.error }
    : { status: 'processing', phase: job.phase };
  function prune() {
    for (const [id, job] of jobs) if (job.finishedAt != null && now() - job.finishedAt > ttlMs) jobs.delete(id);
  }
  function get(userId, id) {
    prune();
    const job = jobs.get(key(userId, id));
    return job ? snapshot(job) : null;
  }
  function canStart() {
    prune();
    return [...jobs.values()].filter(job => job.status === 'processing').length < maxActive;
  }
  function start(userId, id, work) {
    const existing = get(userId, id);
    if (existing) return existing;
    if (!canStart()) throw new Error('Un import est déjà en cours. Réessaie dans quelques instants.');
    if (jobs.size >= maxEntries) {
      const oldest = [...jobs].find(([, job]) => job.status !== 'processing');
      if (oldest) jobs.delete(oldest[0]);
    }
    const job = { status: 'processing', phase: 'ocr', finishedAt: null };
    jobs.set(key(userId, id), job);
    Promise.resolve().then(() => work(phase => {
      if (phase === 'ocr' || phase === 'review') job.phase = phase;
    })).then(result => {
      job.result = result;
      job.status = 'complete';
    }, err => {
      job.error = importError(err);
      job.status = 'error';
    }).finally(() => { job.finishedAt = now(); });
    return snapshot(job);
  }
  return { get, start, canStart };
}

export function importError(err) {
  if (err?.name === 'TimeoutError') return 'La lecture prend trop de temps. Réessaie avec une photo nette cadrée sur la recette.';
  if (err instanceof Error && !['TypeError', 'SyntaxError'].includes(err.name)) return err.message;
  return 'Impossible de joindre le service de lecture. Réessaie dans quelques instants ; ta saisie est conservée.';
}

export const validImportId = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
