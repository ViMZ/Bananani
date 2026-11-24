const API = 'https://commons.wikimedia.org/w/api.php';
const HEADERS = { 'User-Agent': 'Bananani/1.0 (https://bananani.fly.dev; recipe image search)' };
const IMAGE_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

function plain(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').trim().slice(0, 500);
}

function imageInfo(page) {
  const info = page.imageinfo?.[0];
  if (!info || !TYPES.has(info.mime)) return null;
  const license = plain(info.extmetadata?.LicenseShortName?.value);
  if (!/^(CC0|CC BY(?:-SA)? [\d.]+|Public domain)$/i.test(license)) return null;
  const url = info.thumburl || info.url;
  let parsed;
  try { parsed = new URL(url); } catch { return null; }
  if (parsed.protocol !== 'https:' || !IMAGE_HOSTS.has(parsed.hostname) || parsed.port ||
      parsed.username || parsed.password || !parsed.pathname.startsWith('/wikipedia/commons/')) return null;
  const pageId = Number(page.pageid);
  if (!Number.isSafeInteger(pageId) || pageId < 1) return null;
  return {
    pageId, title: plain(page.title?.replace(/^File:/, '')), url: parsed.href,
    source: `https://commons.wikimedia.org/?curid=${pageId}`,
    author: plain(info.extmetadata?.Artist?.value) || 'Auteur indiqué sur la source', license
  };
}

async function query(params, fetcher, signal = AbortSignal.timeout(15000)) {
  const url = new URL(API);
  for (const [key, value] of Object.entries({ action: 'query', format: 'json', prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata', iiurlwidth: '960', iiextmetadatafilter: 'Artist|LicenseShortName', ...params })) {
    url.searchParams.set(key, value);
  }
  const response = await fetcher(url, { headers: HEADERS, signal });
  if (!response.ok) throw new Error('La recherche d’images est momentanément indisponible. Réessaie ou choisis une photo.');
  const body = await response.json();
  if (body.error) throw new Error('La recherche d’images a échoué. Essaie un autre nom de plat.');
  return Object.values(body.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0)).map(imageInfo).filter(Boolean);
}

export async function searchRecipeImages(term, fetcher = fetch) {
  const q = String(term || '').trim().replace(/\s+/g, ' ');
  if (q.length < 2 || q.length > 100) throw new Error('Saisis un nom de plat entre 2 et 100 caractères.');
  const signal = AbortSignal.timeout(15000);
  const search = (words) => query({ generator: 'search', gsrsearch: `${words} filetype:bitmap`,
    gsrnamespace: '6', gsrlimit: '12', iiurlwidth: '330' }, fetcher, signal);

  const exact = await search(q);
  if (exact.length) return exact;

  // CirrusSearch accepte les variantes proches avec « ~ » (banane / banana, chocolat / chocolate).
  const words = q.toLowerCase().match(/[\p{L}\p{M}]{3,}/gu)?.filter(word => !/^(les|des|une|aux|avec|sans|pour)$/.test(word)) ?? [];
  const fuzzy = words.slice(0, 3).map((word, index) => {
    return word.length >= 5 && (index > 0 || words.length === 1) ? `${word}~` : word;
  }).join(' ');
  if (fuzzy && fuzzy !== q.toLowerCase()) {
    try {
      const approximate = await search(fuzzy);
      if (approximate.length) return approximate;
    } catch (err) {
      if (signal.aborted || words.length < 2) throw err;
    }
  }
  return words.length > 1 ? search(words[0]) : [];
}

/** Relit les métadonnées officielles à l'enregistrement ; aucune URL fournie par le client. */
export async function importRecipeImage(pageId, fetcher = fetch) {
  if (!Number.isSafeInteger(Number(pageId)) || Number(pageId) < 1) throw new Error('Image sélectionnée invalide.');
  const [image] = await query({ pageids: String(Number(pageId)) }, fetcher);
  if (!image) throw new Error('Cette image n’est plus disponible avec une licence prise en charge. Choisis-en une autre.');
  const response = await fetcher(image.url, { headers: HEADERS, redirect: 'error', signal: AbortSignal.timeout(20000) });
  const mime = response.headers.get('content-type')?.split(';')[0];
  if (!response.ok || !TYPES.has(mime) || Number(response.headers.get('content-length')) > MAX_BYTES) {
    throw new Error('Impossible d’importer cette image (JPEG, PNG ou WebP, 5 Mo maximum).');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_BYTES) throw new Error('Cette image dépasse 5 Mo. Choisis-en une autre.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  if (!length) throw new Error('L’image est vide. Choisis-en une autre.');
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime];
  return { file: new File(chunks, `commons-${image.pageId}.${extension}`, { type: mime }),
    credit: `${image.title} — ${image.author} — ${image.license}`, source: image.source };
}
