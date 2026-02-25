import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifestPath = path.join(__dirname, '..', 'gemini-extension.json');

try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  let errors = [];

  if (manifest.name !== 'maker-framework-extension') {
    errors.push(`Expected name to be "maker-framework-extension", but got "${manifest.name}"`);
  }

  if (!manifest.version) {
    errors.push('Version is missing');
  } else if (manifest.version !== '0.1.0') {
    errors.push(`Expected version to be "0.1.0", but got "${manifest.version}"`);
  }

  if (errors.length > 0) {
    console.error('Validation failed:');
    errors.forEach(err => console.error(`- ${err}`));
    process.exit(1);
  }

  console.log('Manifest validation successful!');
} catch (err) {
  console.error(`Error reading or parsing manifest: ${err.message}`);
  process.exit(1);
}
