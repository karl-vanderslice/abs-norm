import fs from 'node:fs';

export function loadDatasetFromPath(dataPath) {
  if (!fs.existsSync(dataPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}
