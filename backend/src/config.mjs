import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

export const DEFAULT_PORT = Number.parseInt(process.env.PORT ?? '8787', 10);
export const DB_PATH = process.env.DB_PATH ?? resolve(currentDir, '..', 'data', 'puzzle.sqlite');
