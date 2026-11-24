import { PDFDocument } from 'pdf-lib';

export function captureMime(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function combineRecipeCaptures(captures) {
  const pdf = await PDFDocument.create();
  for (const capture of captures) {
    let image;
    // pdf-lib lit le tampon sous-jacent depuis son début.
    try { image = await pdf.embedJpg(Uint8Array.from(capture)); } catch {
      throw new Error('Une capture est illisible. Retire-la ou choisis une autre image.');
    }
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    const size = image.scale(scale);
    const page = pdf.addPage([size.width, size.height]);
    page.drawImage(image, { x: 0, y: 0, ...size });
  }
  return Buffer.from(await pdf.save());
}
