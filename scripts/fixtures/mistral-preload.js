// Isolated HTTP tests only: this module is explicitly preloaded by the test process.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const target = String(url);
  if (!target.startsWith('https://api.mistral.ai/')) return originalFetch(url, options);
  const request = JSON.parse(options.body);
  if (target.endsWith('/ocr')) {
    const bytes = Buffer.from(request.document.image_url.split(',')[1], 'base64');
    const slow = bytes.includes(Buffer.from('slow-import'));
    if (slow) await new Promise(resolve => setTimeout(resolve, 80));
    const title = bytes.includes(Buffer.from('review-unavailable')) ? 'Relecture indisponible' : slow ? 'Import lent' : 'Pâtes à la tomate';
    return Response.json({ document_annotation: { isRecipe: true, title, description: '', owner: '', servings: null, instructions: '',
      ingredients: [{ name: 'Pâtes', quantity: null, unit: '', notes: '' }, { name: 'Tomates', quantity: null, unit: '', notes: '' }, { name: 'Imprimer ce document', quantity: null, unit: '', notes: '' }] },
    pages: [{ markdown: `${title}\nPâtes\nTomates\nImprimer ce document` }] });
  }
  if (target.endsWith('/chat/completions') && request.model === 'mistral-small-latest') {
    const source = JSON.parse(request.messages[1].content);
    if (source.recipe.title === 'Import lent') await new Promise(resolve => setTimeout(resolve, 100));
    if (source.recipe.title === 'Relecture indisponible') return new Response('upstream-private-detail', { status: 503 });
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
      isRecipe: true, title: 'Pâtes à la tomate', description: 'Sauce tomate maison.', owner: '', servings: 4,
      instructions: '1. Préparer la sauce.\n2. Cuire les pâtes et mélanger.',
      ingredients: [{ sourceIds: [0], name: 'Pâtes', quantity: 320, unit: 'g', notes: '', brand: '', productReference: '', categoryId: 5 },
        { sourceIds: [1], name: 'Tomates', quantity: 600, unit: 'g', notes: '', brand: '', productReference: '', categoryId: 0 }],
      explanations: ['Portions et quantités estimées ; pied de page retiré.']
    }) } }] });
  }
  throw new Error('Unexpected Mistral call in HTTP test');
};
