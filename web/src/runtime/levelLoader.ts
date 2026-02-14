import { parseLevelText } from '../core/levelParser';
import type { ParsedLevel } from '../core/types';

export async function loadLevelsFromManifest(manifestUrl: string): Promise<ParsedLevel[]> {
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok) {
    throw new Error(`Failed to load level manifest: ${manifestResponse.status}`);
  }

  const manifest = (await manifestResponse.json()) as string[];
  const base = manifestUrl.substring(0, manifestUrl.lastIndexOf('/') + 1);

  const texts = await Promise.all(
    manifest.map(async (fileName) => {
      const response = await fetch(`${base}${fileName}`);
      if (!response.ok) {
        throw new Error(`Failed to load level file ${fileName}: ${response.status}`);
      }
      return { fileName, raw: await response.text() };
    }),
  );

  return texts.map(({ fileName, raw }) => parseLevelText(fileName.replace('.txt', ''), raw));
}
