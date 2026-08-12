import QRCode from 'qrcode';
import { getRecipesForCards } from '$lib/server/recipes';

export async function load({ url, locals }) {
  const p = url.searchParams.get('ids');
  const ids = p
    ? p.split(',').map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0)
    : null;

  const rows = await getRecipesForCards(locals.user.id, ids);

  // Pré-rendu serveur des QR (SVG inline) : mêmes réglages que la fiche A4
  // (margin 1 = quiet zone garantie, ECC M), générés en parallèle.
  const cards = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      qrSvg: await QRCode.toString(r.code, {
        type: 'svg',
        margin: 1,
        width: 200,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' }
      })
    }))
  );

  return { cards };
}
