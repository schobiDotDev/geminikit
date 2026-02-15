import { generateImage } from './src/lib';

async function main() {
  const result = await generateImage(
    'a neon-lit cyberpunk cityscape at night with glowing signs and rain-slicked streets',
    '/tmp/geminikit-test.png',
    { headless: false }
  );

  console.log('Result:', result);
}

main().catch(console.error);
