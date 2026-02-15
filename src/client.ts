import { type Page } from 'playwright';
import { GeminiBrowser } from './browser';
import { GeminiConfig, GenerateImageOptions, ImageResult } from './types';
import { AuthenticationError, GenerationError } from './errors';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export class GeminiClient {
  private browser: GeminiBrowser;

  constructor(config: GeminiConfig = {}) {
    this.browser = new GeminiBrowser({
      userDataDir: config.userDataDir,
    });
  }

  async connect(options: { headless?: boolean } = {}): Promise<void> {
    await this.browser.connect(options);

    const page = this.browser.page;
    console.log('Navigating to Gemini...');
    await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Handle cookie consent if it appears
    await this.handleCookieConsent();

    await this.ensureLoggedIn();
  }

  async disconnect(): Promise<void> {
    await this.browser.disconnect();
  }

  private get page(): Page {
    return this.browser.page;
  }

  async ensureLoggedIn(): Promise<void> {
    const page = this.page;

    // Check if we landed on the Gemini app with a chat input
    const loggedIn = await page.evaluate(() => {
      if (window.location.href.includes('accounts.google.com')) return false;
      return !!(
        document.querySelector('rich-textarea') ||
        document.querySelector('div[contenteditable="true"]') ||
        document.querySelector('.ql-editor') ||
        document.querySelector('textarea')
      );
    });

    if (loggedIn) {
      console.log('Already logged in to Gemini');
      return;
    }

    console.log('Not logged in. Please log in to Google in the browser window.');
    console.log('Session will be saved for future headless use.');

    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(5000);
      try {
        if (page.url().includes('gemini.google.com')) {
          const ready = await page.evaluate(() => !!(
            document.querySelector('rich-textarea') ||
            document.querySelector('div[contenteditable="true"]') ||
            document.querySelector('.ql-editor') ||
            document.querySelector('textarea')
          ));
          if (ready) {
            console.log('Login detected!');
            return;
          }
        }
      } catch {}
    }
    throw new AuthenticationError('Login timeout after 5 minutes.');
  }

  async generateImage(
    prompt: string,
    outputPath: string,
    options: GenerateImageOptions = {}
  ): Promise<ImageResult> {
    const page = this.page;
    const timeout = options.timeout ?? 120000;

    // Navigate to fresh Gemini chat
    await page.goto('https://gemini.google.com/app', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Build prompt
    let fullPrompt = `Generate an image: ${prompt}`;
    if (options.aspectRatio) {
      fullPrompt += ` (aspect ratio: ${options.aspectRatio})`;
    }

    console.log(`Typing prompt: "${prompt.substring(0, 60)}${prompt.length > 60 ? '...' : ''}"`);

    // Dismiss any overlays (e.g. human-review-disclosure)
    await this.dismissOverlays(page);

    // Type into Gemini's chat input
    const input = page.locator('div[contenteditable="true"]').first();
    await input.click();
    await input.fill(fullPrompt);
    await page.waitForTimeout(500);

    // Submit with Enter (locale-independent, avoids matching wrong buttons)
    await page.keyboard.press('Enter');

    console.log('Waiting for image generation...');

    // Wait for a generated image to appear (large img inside a button)
    const startTime = Date.now();
    let imageFound = false;

    while (Date.now() - startTime < timeout) {
      await page.waitForTimeout(3000);
      process.stdout.write('.');

      // Check for refusals
      const refusal = await page.evaluate(() => {
        const body = document.body.textContent || '';
        if (body.includes("I can't generate") || body.includes("I'm not able to generate")) {
          return 'Gemini refused to generate this image. Try a different prompt.';
        }
        return null;
      });
      if (refusal) {
        console.log('');
        throw new GenerationError(refusal);
      }

      // Look for generated image — Gemini wraps them in buttons with class "image loaded"
      const found = await page.locator('img.image.loaded').first().isVisible().catch(() => false);
      if (found) {
        imageFound = true;
        console.log('\nImage detected!');
        break;
      }
    }

    if (!imageFound) {
      console.log('');
      throw new GenerationError(`Image generation timed out after ${timeout / 1000}s`);
    }

    // Download full-resolution image via the inline download button
    // No need to click the image first — download button is visible inline
    console.log('Downloading original resolution...');
    const absPath = path.resolve(outputPath);
    const outputDir = path.dirname(absPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Wait for the download button to appear and stabilize
    const downloadBtn = page.locator('[data-test-id="download-generated-image-button"]').first();
    await downloadBtn.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(1000);

    // Playwright's download handling: wait for download event while clicking
    // Retry once if the first attempt doesn't trigger a download
    let download;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 30000 }),
          this.clickDownloadButton(page),
        ]);
        break;
      } catch {
        if (attempt === 0) {
          console.log('Retrying download...');
          await page.waitForTimeout(2000);
        } else {
          throw new GenerationError('Download button did not trigger a file download');
        }
      }
    }

    // Save to desired path
    await download!.saveAs(absPath);
    const failure = await download!.failure();
    if (failure) {
      throw new GenerationError(`Download failed: ${failure}`);
    }

    // Remove Gemini SynthID watermark using OpenCV inpainting
    await this.removeWatermark(absPath);

    // Get file size
    const stats = fs.statSync(absPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    // Try to read image dimensions
    const dimensions = await this.getImageDimensions(absPath);

    console.log(`Saved: ${outputPath} (${sizeMB} MB, ${dimensions.width}x${dimensions.height})`);

    return {
      imagePath: absPath,
      width: dimensions.width,
      height: dimensions.height,
    };
  }

  private async handleCookieConsent(): Promise<void> {
    const page = this.page;

    // Check if we're on the consent page
    if (page.url().includes('consent.google.com')) {
      console.log('Handling cookie consent...');
      try {
        const acceptButton = page.getByRole('button', { name: /accept all/i });
        if (await acceptButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await acceptButton.click();
          await page.waitForTimeout(2000);
          console.log('Cookie consent accepted');
        }
      } catch (err) {
        console.warn('Could not handle cookie consent:', err);
      }
    }
  }

  private async dismissOverlays(page: Page): Promise<void> {
    // Dismiss human-review-disclosure or similar overlays
    try {
      // Look for close button specifically (not the "Manage activities" button which opens a new tab)
      const closeButton = page.locator('human-review-disclosure button').last(); // Close button is last
      if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeButton.click();
        await page.waitForTimeout(500);
      }
    } catch {}
  }

  private async clickDownloadButton(page: Page): Promise<void> {
    // Primary: stable data-test-id selector for "Download in original size"
    const downloadBtn = page.locator('[data-test-id="download-generated-image-button"]').first();
    if (await downloadBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await downloadBtn.click();
      return;
    }

    // Fallback: any button with download-related role/text
    const fallback = page.getByRole('button', { name: /download/i }).first();
    if (await fallback.isVisible({ timeout: 3000 }).catch(() => false)) {
      await fallback.click();
      return;
    }

    throw new GenerationError('Could not find download button');
  }

  private async removeWatermark(filePath: string): Promise<void> {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);

    // WatermarkRemover-AI: Florence-2 detection + LaMA inpainting
    const removerDir = path.join(os.homedir(), 'code', 'WatermarkRemover-AI');
    const venvPython = path.join(removerDir, 'venv', 'bin', 'python');
    const script = path.join(removerDir, 'remwm.py');

    if (!fs.existsSync(script)) {
      console.warn('Watermark removal skipped: WatermarkRemover-AI not found');
      return;
    }

    // The tool won't overwrite input, so use a temp output then replace
    const tmpOut = filePath + '.clean.png';

    try {
      const { stdout } = await execFileAsync(venvPython, [script, filePath, tmpOut], {
        timeout: 120000,
        cwd: removerDir,
      });
      if (stdout.trim()) {
        // Only log the last meaningful line
        const lines = stdout.trim().split('\n').filter((l: string) => !l.includes('Loading weights'));
        const last = lines[lines.length - 1];
        if (last) console.log(last);
      }

      // Replace original with cleaned version
      if (fs.existsSync(tmpOut)) {
        fs.renameSync(tmpOut, filePath);
      }
    } catch (err: any) {
      // Clean up temp file on failure
      if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
      console.warn(`Watermark removal skipped: ${err.message || err}`);
    }
  }

  private async getImageDimensions(filePath: string): Promise<{ width: number; height: number }> {
    // Read PNG header for dimensions (bytes 16-23)
    try {
      const fd = fs.openSync(filePath, 'r');
      const header = Buffer.alloc(24);
      fs.readSync(fd, header, 0, 24, 0);
      fs.closeSync(fd);

      // PNG signature check
      if (header[0] === 0x89 && header[1] === 0x50) {
        const width = header.readUInt32BE(16);
        const height = header.readUInt32BE(20);
        return { width, height };
      }

      // JPEG: search for SOF0 marker
      const buf = fs.readFileSync(filePath);
      for (let i = 0; i < buf.length - 9; i++) {
        if (buf[i] === 0xff && buf[i + 1] === 0xc0) {
          const height = buf.readUInt16BE(i + 5);
          const width = buf.readUInt16BE(i + 7);
          return { width, height };
        }
      }
    } catch {}

    return { width: 0, height: 0 };
  }
}
