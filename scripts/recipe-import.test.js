import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createImportJobs, validImportId } from '../src/lib/server/recipe-import-jobs.js';
import { importRecipe } from '../src/lib/recipes/import.js';

const id = 'c8f62001-de30-4374-9436-f5f9bf53ab26';
const file = new File(['photo'], 'recipe.jpg', {type: 'image/jpeg'});
const recipe = {recipe: {title: 'Pâtes'}, ingredients: [{name: 'Pâtes'}]};
const missing = () => Response.json({error: 'not found'}, {status: 404});
const processing = phase => Response.json({status: 'processing', phase}, {status: 202});
const complete = () => Response.json({status: 'complete', result: recipe});
const tick = () => new Promise(resolve => setImmediate(resolve));

test('imports automatically through short requests and follows OCR then review', async () => {
  const phases = [];
  let calls = 0;
  const result = await importRecipe(file, {id, pause: async () => {}, onPhase: phase => phases.push(phase), fetcher: async (url, options) => {
    calls++;
    if (calls === 1) return missing();
    if (calls === 2) {
      assert.equal(url, '/recipes/ocr?mode=async');
      assert.equal(options.headers['X-Import-Id'], id);
      assert.equal(await options.body.get('image').text(), 'photo');
      return processing('ocr');
    }
    return calls === 3 ? processing('review') : complete();
  }});
  assert.deepEqual(result, recipe);
  assert.deepEqual(phases, ['upload', 'ocr', 'review']);
});

test('recovers a lost upload response without sending or billing the OCR twice', async () => {
  let calls = 0, uploads = 0;
  const result = await importRecipe(file, {id, pause: async () => {}, fetcher: async (url, options) => {
    calls++;
    if (options.method === 'POST') { uploads++; throw new TypeError('Failed to fetch'); }
    return calls === 1 ? missing() : complete();
  }});
  assert.deepEqual(result, recipe);
  assert.equal(uploads, 1);
});

test('reuses an already completed result without uploading an image', async () => {
  const result = await importRecipe(file, {id, fetcher: async (url, options) => {
    assert.notEqual(options.method, 'POST');
    return complete();
  }});
  assert.deepEqual(result, recipe);
});

test('network failures are retried a bounded number of times and get a readable error', async () => {
  for (const failure of [new TypeError('Failed to fetch'), new Error('Failed to fetch'), new DOMException('Network request failed', 'NetworkError')]) {
    let attempts = 0;
    await assert.rejects(importRecipe(file, {id, pause: async () => {}, fetcher: async () => {
      attempts++;
      throw failure;
    }}), error => error.message.includes('ta photo et ta saisie sont conservées') && !error.message.includes('fetch'));
    assert.equal(attempts, 5);
  }
});

test('expired sessions and provider errors do not repeat the analysis', async () => {
  await assert.rejects(importRecipe(file, {id, fetcher: async () => ({redirected: true, status: 200})}), /session a expiré/);
  await assert.rejects(importRecipe(file, {id, fetcher: async () => Response.json({status: 'error', error: 'Photo illisible'})}), error => error.restartImport && /illisible/.test(error.message));
  let calls = 0;
  await assert.rejects(importRecipe(file, {id, fetcher: async () => ++calls === 1 ? missing() : Response.json({error: 'Service indisponible'}, {status: 503})}), /Service indisponible/);
  assert.equal(calls, 2);
});

test('lost jobs can restart and long polling is bounded', async () => {
  let calls = 0;
  await assert.rejects(importRecipe(file, {id, pause: async () => {}, fetcher: async () => {
    calls++;
    return calls === 1 || calls === 3 ? missing() : processing('ocr');
  }}), error => error.restartImport && /interrompu/.test(error.message));
  let time = 0;
  await assert.rejects(importRecipe(file, {id, now: () => time, timeoutMs: 100, pause: async () => {time += 100;}, fetcher: async () => processing('review')}), /prend trop de temps/);
});

test('server jobs are isolated by user, idempotent and expose processing phases', async () => {
  const jobs = createImportJobs();
  let finish, count = 0;
  const run = onPhase => new Promise(resolve => {count++; onPhase('review'); finish = resolve;});
  assert.equal(jobs.start(1, id, run).status, 'processing');
  await tick();
  assert.equal(jobs.get(1, id).phase, 'review');
  assert.equal(jobs.get(2, id), null);
  assert.equal(jobs.start(1, id, run).phase, 'review');
  assert.equal(count, 1);
  assert.throws(() => jobs.start(2, 'another', run), /déjà en cours/);
  finish(recipe);
  await tick();
  assert.deepEqual(jobs.get(1, id), {status: 'complete', result: recipe});
  assert.equal(jobs.canStart(), true);
  jobs.start(1, id, run);
  assert.equal(count, 1);
});

test('server expires results, bounds memory and never exposes upstream network details', async () => {
  let time = 0;
  const jobs = createImportJobs({now: () => time, ttlMs: 100, maxEntries: 1});
  jobs.start(1, 'one', async () => recipe);
  await tick();
  jobs.start(1, 'two', async () => {throw new TypeError('upstream secret details');});
  await tick();
  assert.equal(jobs.get(1, 'one'), null);
  assert.doesNotMatch(jobs.get(1, 'two').error, /secret|details/);
  time = 101;
  assert.equal(jobs.get(1, 'two'), null);
  assert.equal(validImportId(id), true);
  for (const invalid of [null, '../abc', 'another', id.repeat(3)]) assert.equal(validImportId(invalid), false);
});
