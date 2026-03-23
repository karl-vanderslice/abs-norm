import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.resolve(__dirname, '..', 'data', 'norm-macdonald-live.json');

const port = Number(process.env.PORT || 8042);
const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const app = createApp({
  dataPath: DATA_PATH,
  publicBaseUrl
});

app.listen(port, () => {
  console.log(`abs-norm listening on ${publicBaseUrl}`);
});
