/** Masque les lignes supprimées à la fin de leur délai d'annulation. */
export function withUndoWindow(getData) {
  let expiredUntil = $state(0);
  let items = $derived(getData().items.filter((item) => !item.removedUntil || item.removedUntil > expiredUntil));

  $effect(() => {
    const { items, now } = getData();
    const deadlines = new Set(items.map((item) => item.removedUntil).filter(Boolean));
    const timers = [...deadlines].map((deadline) => setTimeout(() => {
      expiredUntil = Math.max(expiredUntil, deadline);
    }, Math.max(0, deadline - now)));
    return () => timers.forEach(clearTimeout);
  });

  return { get items() { return items; } };
}
