import * as selfsigned from 'selfsigned';
import * as fs from 'fs';
import * as path from 'path';

const secretsDir = path.join(__dirname, '..', '..', 'secrets');

if (!fs.existsSync(secretsDir)) {
  fs.mkdirSync(secretsDir, { recursive: true });
}

console.log('Generating self-signed SSL certificates...');

const attrs = [{ name: 'commonName', value: 'localhost' }];
const options = { days: 365 };

// Handle potential async/sync mismatch or API changes
(async () => {
  try {
    const pems: any = await selfsigned.generate(attrs, options as any); // Try await just in case

    console.log('PEMs keys:', Object.keys(pems));

    if (!pems.private || (!pems.cert && !pems.certificate)) {
      throw new Error('Failed to generate valid PEMs: missing private key or certificate');
    }

    const cert = pems.cert || pems.certificate;

    fs.writeFileSync(path.join(secretsDir, 'private-key.pem'), pems.private);
    fs.writeFileSync(path.join(secretsDir, 'public-certificate.pem'), cert);
    console.log('SSL certificates generated successfully.');
  } catch (error) {
    console.error('Error generating SSL:', error);
    process.exit(1);
  }
})();

console.log('SSL certificates generated successfully in secrets/ directory.');
