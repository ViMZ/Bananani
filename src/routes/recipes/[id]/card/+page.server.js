import { error } from '@sveltejs/kit';
import QRCode from 'qrcode';
import { getRecipeWithIngredients } from '$lib/server/recipes';

export async function load({ params }) {
  const id = Number(params.id);
  if (Number.isNaN(id)) throw error(404);
  const data = await getRecipeWithIngredients(id);
  if (!data) throw error(404);

  // Pré-rendu serveur du QR (SVG inline) — évite le flicker à l'impression
  // et garantit que le payload est dans le HTML dès le SSR.
  const qrSvg = await QRCode.toString(data.recipe.code, {
    type: 'svg',
    margin: 1,
    width: 220,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' }
  });

  return { ...data, qrSvg };
}
