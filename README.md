# GeminiKit

Browser automation library for Google Gemini image generation with persistent sessions and automatic watermark removal.

> **⚠️ IMPORTANT DISCLAIMER**
>
> This tool automates interaction with Google Gemini's web interface using browser automation. **This is likely against Google's Terms of Service.** Use of this tool is **entirely at your own risk**.
>
> **Potential Risks:**
> - Your Google account may be suspended or banned
> - You may lose access to Google services
> - Google may implement rate limits or CAPTCHAs
> - This tool may break without notice if Google changes their interface
>
> **By using this software, you acknowledge:**
> - You understand this violates Google's Terms of Service
> - You accept full responsibility for any consequences
> - The authors are not liable for any account bans, service disruptions, or other damages
> - This is provided for educational and research purposes only
>
> **Use responsibly and at your own risk.**

## Features

- 🔐 **Persistent Login Sessions** - Log in once, use headlessly forever
- 🎨 **High-Quality Image Generation** - Generate images via Google Gemini
- 🧹 **Optional Watermark Removal** - Integrates with WatermarkRemover-AI (external tool, see setup below)
- 🤖 **Smart Cookie Handling** - Automatically accepts consent pages
- ⚡ **Headless Support** - Run invisibly after initial login
- 🛡️ **Robust Error Handling** - Handles refusals, timeouts, and edge cases

## Installation

**⚠️ READ THE DISCLAIMER ABOVE BEFORE INSTALLING ⚠️**

By installing this package, you acknowledge that you understand and accept the risks.

```bash
npm install gemgen
```

Or with your preferred package manager:

```bash
# yarn
yarn add gemgen

# pnpm
pnpm add gemgen

# bun
bun add gemgen
```

## Quick Start

### First Run (Interactive Login)

On the first run, use `headless: false` to log in to your Google account:

```typescript
import { generateImage } from 'gemgen';

const result = await generateImage(
  'a neon-lit cyberpunk cityscape at night with glowing signs and rain-slicked streets',
  './output.png',
  { headless: false }
);

console.log('Image saved to:', result.imagePath);
console.log('Dimensions:', `${result.width}x${result.height}`);
```

A browser window will open. Log in to your Google account manually. The session will be saved for future use.

### Subsequent Runs (Headless)

After logging in once, you can run headlessly:

```typescript
import { generateImage } from 'gemgen';

const result = await generateImage(
  'a serene mountain landscape at sunset',
  './mountain.png'
  // headless: true is the default
);
```

## API Reference

### `generateImage(prompt, outputPath, options?)`

Generates an image using Google Gemini and saves it to the specified path.

**Parameters:**

- `prompt` (string): The text prompt describing the image to generate
- `outputPath` (string): Path where the generated image will be saved
- `options` (object, optional):
  - `headless` (boolean): Run browser in headless mode. Default: `true`
  - `timeout` (number): Max wait time for image generation in milliseconds. Default: `120000` (2 minutes)
  - `aspectRatio` (string): Desired aspect ratio hint (e.g., "16:9", "1:1"). Note: Gemini may not always honor this

**Returns:**

Promise that resolves to an `ImageResult` object:
```typescript
{
  imagePath: string;  // Absolute path to the saved image
  width: number;      // Image width in pixels
  height: number;     // Image height in pixels
}
```

**Example:**

```typescript
const result = await generateImage(
  'a futuristic city with flying cars',
  './future-city.png',
  { aspectRatio: '16:9', timeout: 180000 }
);
```

### Advanced Usage

#### Using the `GeminiClient` Class

For more control over the browser lifecycle:

```typescript
import { GeminiClient } from 'gemgen';

const client = new GeminiClient();

try {
  // Connect once
  await client.connect({ headless: false });

  // Generate multiple images
  const img1 = await client.generateImage(
    'a sunset over the ocean',
    './sunset.png'
  );

  const img2 = await client.generateImage(
    'a mountain range covered in snow',
    './mountains.png'
  );
} finally {
  // Clean up
  await client.disconnect();
}
```

#### Custom Browser Profile Directory

By default, the browser profile is saved to `~/.geminikit/browser-profile`. You can customize this:

```typescript
import { GeminiClient } from 'gemgen';

const client = new GeminiClient({
  userDataDir: '/path/to/custom/profile'
});
```

## How It Works

1. **Browser Automation**: Uses Playwright with persistent browser contexts to maintain login sessions
2. **Session Persistence**: Saves your Google login session locally so you only need to log in once
3. **Smart Navigation**: Automatically handles cookie consent pages and overlays
4. **Image Detection**: Waits for Gemini to generate the image, with timeout protection
5. **Download Handling**: Clicks the download button and saves the full-resolution image
6. **Watermark Removal** (Optional): If WatermarkRemover-AI is installed, automatically removes Gemini's SynthID watermark

## Watermark Removal Setup (Optional)

GeminiKit can automatically remove Gemini's SynthID watermark if you have [WatermarkRemover-AI](https://github.com/zuruoke/WatermarkRemover-AI) installed:

```bash
# Clone the watermark remover
cd ~/code
git clone https://github.com/zuruoke/WatermarkRemover-AI.git
cd WatermarkRemover-AI

# Install dependencies
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

GeminiKit will automatically detect and use it if available at `~/code/WatermarkRemover-AI/`.

## Troubleshooting

### "Login timeout after 5 minutes"

- Make sure you're using `headless: false` on first run
- Check that you can manually access https://gemini.google.com/app in your browser
- Try clearing the browser profile: `rm -rf ~/.geminikit/browser-profile`

### Images not generating / stuck waiting

- Gemini may refuse certain prompts. Check the console for refusal messages
- Increase the timeout: `{ timeout: 300000 }` (5 minutes)
- Try a different prompt

### Activity page keeps opening

This has been fixed in the latest version. Make sure you're on the newest version:

```bash
npm update gemgen
```

### Browser profile location

The default profile is saved to `~/.geminikit/browser-profile`. This directory contains:
- Cookies and session data
- Login credentials (encrypted by Chromium)
- Browser settings

**Security Note**: Keep this directory private. Don't commit it to git or share it publicly.

## System Requirements

- Node.js 18 or later
- Chromium/Chrome (installed automatically by Playwright)
- Google account with Gemini access

## Development

```bash
# Clone the repository
git clone https://github.com/schobiDotDev/geminikit.git
cd geminikit

# Install dependencies
npm install

# Build
npm run build

# Run tests
npx tsx test-login.ts
```

## How GeminiKit Differs From Other Solutions

- **No API key required** - Uses browser automation instead of official APIs
- **Persistent sessions** - Log in once, use forever (until session expires)
- **Full-resolution downloads** - Gets the original high-res image, not a preview
- **Watermark removal** - Optional automatic removal of SynthID watermarks
- **Handles edge cases** - Cookie consent, overlays, refusals, timeouts

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details

## Legal Disclaimer

**USE AT YOUR OWN RISK**

This software is provided for **educational and research purposes only**. By using this software, you agree to the following:

1. **Terms of Service Violation**: This tool automates Google Gemini's web interface, which **likely violates Google's Terms of Service**. Google explicitly prohibits automated access to their services without permission.

2. **No Warranty**: This software is provided "AS IS" without warranty of any kind, express or implied. The authors make no guarantees about functionality, reliability, or fitness for any purpose.

3. **Account Risk**: Using this tool may result in:
   - Permanent suspension of your Google account
   - Loss of access to all Google services (Gmail, Drive, Photos, etc.)
   - IP bans or rate limiting
   - Legal action from Google

4. **No Liability**: The authors and contributors are not liable for:
   - Account suspensions or bans
   - Data loss
   - Service disruptions
   - Any direct, indirect, incidental, or consequential damages
   - Any legal consequences

5. **Your Responsibility**: You are solely responsible for:
   - Compliance with all applicable laws and terms of service
   - Any consequences of using this software
   - Understanding and accepting the risks

6. **Not for Production**: This tool is **not intended for production use, commercial use, or any use beyond personal experimentation**.

**By downloading, installing, or using this software, you acknowledge that you have read, understood, and agreed to these terms, and you accept full responsibility for any consequences.**

## Author

Built by [schobiDotDev](https://github.com/schobiDotDev)
