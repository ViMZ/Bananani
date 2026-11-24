import { Resolver } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { decodeBuffer } from 'encoding-sniffer';
import { Parser } from 'htmlparser2';
import ipaddr from 'ipaddr.js';
import { canonicalUnit } from '../ingredients/units.js';
import { MAX_RECIPE_URL_LENGTH } from '../recipes/import-limits.js';
import { validateRecipe } from './recipe-ocr.js';

const MAX_HTML_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const BASIC_URL_ERROR = 'Colle le lien complet d’une page publique (https:// ou http://).';
const UNREADABLE_URL = 'Impossible de lire cette page. Tu peux importer tes captures à la place.';
const NO_RECIPE = 'La recette complète n’a pas été trouvée sur cette page. Tu peux importer tes captures à la place.';
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

export function parseRecipeUrl(value) {
  if (typeof value !== 'string' || value.length > MAX_RECIPE_URL_LENGTH) throw new Error(BASIC_URL_ERROR);
  let url;
  try { url = new URL(value); } catch { throw new Error(BASIC_URL_ERROR); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
      !url.hostname.includes('.') || isIP(url.hostname)) {
    throw new Error(BASIC_URL_ERROR);
  }
  url.hash = '';
  return url;
}

export function isPublicAddress(value) {
  const address = ipaddr.process(value);
  if (address.range() !== 'unicast') return false;
  if (address.kind() === 'ipv4') return true;
  const [network, bits] = ipaddr.parseCIDR('2000::/3');
  return address.match(network, bits);
}

async function publicAddresses(hostname, signal) {
  const resolver = new Resolver({ timeout: 2500, tries: 2 });
  const cancel = () => resolver.cancel();
  signal.throwIfAborted();
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const results = await Promise.allSettled([resolver.resolve4(hostname), resolver.resolve6(hostname)]);
    signal.throwIfAborted();
    const addresses = results.flatMap((result, index) => result.status === 'fulfilled'
      ? result.value.map(address => ({ address, family: index === 0 ? 4 : 6 })) : []);
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error(UNREADABLE_URL);
    return addresses;
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}

function requestPage(url, addresses, signal) {
  const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const req = request(url, {
      agent: false,
      signal,
      // Connect only to the addresses validated above, including on a second DNS answer.
      lookup: (_, options, done) => {
        const eligible = options.family ? addresses.filter(address => address.family === options.family) : addresses;
        if (!eligible.length) return done(new Error(UNREADABLE_URL));
        if (options.all) return done(null, eligible);
        done(null, eligible[0].address, eligible[0].family);
      },
      headers: { Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity', 'User-Agent': 'Bananani Recipe Import' }
    }, resolve);
    req.once('error', reject);
    req.end();
  });
}

async function fetchRecipePage(url) {
  const signal = AbortSignal.timeout(12000);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const addresses = await publicAddresses(url.hostname, signal);
    const response = await requestPage(url, addresses, signal);
    try {
      if (REDIRECT_STATUS.has(response.statusCode) && response.headers.location && redirect < MAX_REDIRECTS) {
        url = parseRecipeUrl(new URL(response.headers.location, url).href);
        continue;
      }
      const contentType = response.headers['content-type'] ?? '';
      const encoding = response.headers['content-encoding'];
      if (response.statusCode !== 200 || !/^(text\/html|application\/xhtml\+xml)\b/i.test(contentType) ||
          (encoding && encoding.toLowerCase() !== 'identity') || Number(response.headers['content-length']) > MAX_HTML_BYTES) {
        throw new Error(UNREADABLE_URL);
      }
      let total = 0;
      const chunks = [];
      for await (const chunk of response) {
        total += chunk.length;
        if (total > MAX_HTML_BYTES) throw new Error(UNREADABLE_URL);
        chunks.push(chunk);
      }
      const charset = contentType.match(/;\s*charset\s*=\s*["']?([^;"'\s]+)/i)?.[1];
      return decodeBuffer(Buffer.concat(chunks, total), { transportLayerEncodingLabel: charset, defaultEncoding: 'UTF-8' });
    } finally {
      response.destroy();
    }
  }
  throw new Error(UNREADABLE_URL);
}

function plainText(value) {
  if (typeof value !== 'string') return '';
  const chunks = [];
  let hidden = false;
  new Parser({
    onopentag(tag) {
      if (tag === 'script' || tag === 'style') hidden = true;
      if (!hidden && tag === 'br') chunks.push('\n');
    },
    ontext(text) {
      if (!hidden) chunks.push(text);
    },
    onclosetag(tag) {
      if (tag === 'script' || tag === 'style') hidden = false;
      if (!hidden && /^(p|li|div|h[1-6])$/.test(tag)) chunks.push('\n');
    }
  }).end(value);
  return chunks.join('').replace(/\r\n?/g, '\n').replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const types = (node, type) => [node['@type']].flat().some(value =>
  typeof value === 'string' && value.replace(/^https?:\/\/schema\.org\//i, '') === type);

function instructionsText(value, depth = 0) {
  if (!value || depth > 15) return '';
  if (Array.isArray(value)) return value.map(step => instructionsText(step, depth + 1)).filter(Boolean).join('\n\n');
  if (typeof value === 'string') return plainText(value);
  if (types(value, 'HowToSection') || value.itemListElement) {
    return [plainText(value.name), instructionsText(value.itemListElement, depth + 1)].filter(Boolean).join('\n\n');
  }
  return plainText(value.text) || plainText(value.name);
}

const fractions = { '¼': '1/4', '½': '1/2', '¾': '3/4', '⅓': '1/3', '⅔': '2/3',
  '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5', '⅙': '1/6', '⅚': '5/6',
  '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
const webUnits = new Map(Object.entries({
  'cuillère à café': 'c. à café', 'cuillères à café': 'c. à café', 'c à c': 'c. à café', 'c. à c.': 'c. à café',
  'cuillère à soupe': 'c. à soupe', 'cuillères à soupe': 'c. à soupe', 'c à s': 'c. à soupe', 'c. à s.': 'c. à soupe',
  teaspoon: 'c. à café', teaspoons: 'c. à café', tsp: 'c. à café',
  tablespoon: 'c. à soupe', tablespoons: 'c. à soupe', tbsp: 'c. à soupe'
}));
const unsupportedUnit = /^(?:tasses?|cups?|oz\.?|ounces?|lbs?\.?|pounds?|sticks?)$/i;

function parseIngredient(line) {
  const unparsed = { name: line, quantity: null, unit: '', notes: '' };
  const normalized = line.replace(/[¼½¾⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, fraction => ' ' + fractions[fraction]).trimStart();
  const match = normalized.match(/^(?:(?:(\d+)\s+)?(\d+)\s*[⁄/]\s*(\d+)|(\d+(?:[.,]\d+)?))\s*(.+)$/);
  if (!match) return unparsed;
  const [, whole, numerator, denominator, decimal, remaining] = match;
  const amount = decimal ? Number(decimal.replace(',', '.')) : Number(whole || 0) + Number(numerator) / Number(denominator);
  const rest = remaining.trim();
  if (!Number.isFinite(amount) || /^(?:[\d⁄/–—+-]|(?:à|ou|to|x)\s)/i.test(rest)) return unparsed;

  const words = rest.split(' ');
  for (let size = Math.min(3, words.length - 1); size >= 1; size--) {
    const unitText = words.slice(0, size).join(' ').replace(/\(s\)/gi, 's');
    const unit = webUnits.get(unitText.toLowerCase()) || canonicalUnit(unitText);
    const name = words.slice(size).join(' ').replace(/^(?:de |d['’]|of )/i, '');
    if (name && unit) return { name, quantity: amount, unit, notes: '' };
    if (name && unsupportedUnit.test(unitText)) {
      const amountText = normalized.slice(0, normalized.length - remaining.length).trim();
      return { name, quantity: null, unit: '', notes: amountText + ' ' + unitText };
    }
  }
  return { name: rest, quantity: amount, unit: '', notes: '' };
}

function servingsOf(value) {
  for (const option of [value].flat()) {
    const match = String(option ?? '').trim().match(/^(?:(?:pour|serves)\s+)?(\d{1,2})(?:\s*(?:personnes?|parts?|portions?|servings?|people))?$/i);
    if (match && Number(match[1]) >= 1 && Number(match[1]) <= 50) return Number(match[1]);
  }
  return null;
}

function recipeFromMarkup(node) {
  const title = plainText(node.name);
  const instructions = instructionsText(node.recipeInstructions);
  const ingredients = [node.recipeIngredient].flat().map(plainText).filter(Boolean).map(parseIngredient);
  if (!title || !instructions || !ingredients.length || ingredients.length > 100 || instructions.length > 30000) return null;
  const owner = [node.author].flat().map(author => plainText(author?.name ?? author)).filter(Boolean).join(', ');
  return validateRecipe({ isRecipe: true, title, instructions, ingredients, owner, servings: servingsOf(node.recipeYield) });
}

function recipeFromJson(text) {
  let data;
  try { data = JSON.parse(text); } catch { return null; }
  const pending = [data];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== 'object') continue;
    if (!Array.isArray(node) && types(node, 'Recipe')) {
      const recipe = recipeFromMarkup(node);
      if (recipe) return recipe;
    }
    for (const value of Object.values(node).reverse()) {
      if (value && typeof value === 'object') pending.push(value);
    }
  }
  return null;
}

export function extractLinkedRecipe(html) {
  let script = null;
  let recipe;
  const parser = new Parser({
    onopentag(tag, attributes) {
      if (tag === 'script' && attributes.type?.trim().toLowerCase() === 'application/ld+json') script = '';
    },
    ontext(text) {
      if (script !== null) script += text;
    },
    onclosetag(tag) {
      if (tag !== 'script' || script === null) return;
      recipe = recipeFromJson(script);
      script = null;
      if (recipe) parser.pause();
    }
  });
  parser.end(html);
  if (!recipe) throw new Error(NO_RECIPE);
  return recipe;
}

export async function importLinkedRecipe(url) {
  let html;
  try { html = await fetchRecipePage(url); } catch { throw new Error(UNREADABLE_URL); }
  return extractLinkedRecipe(html);
}
