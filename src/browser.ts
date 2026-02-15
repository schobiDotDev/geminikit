/**
 * Browser automation for Google Gemini
 *
 * Uses Playwright with a persistent browser context so Google login
 * sessions survive across runs. First run opens visible browser for
 * manual login; subsequent runs reuse the saved session headlessly.
 */

import { chromium, type BrowserContext, type Page, type Download } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const DEFAULT_PROFILE_DIR = path.join(os.homedir(), '.geminikit', 'browser-profile');

export class GeminiBrowser {
  private context: BrowserContext | null = null;
  private _page: Page | null = null;
  private userDataDir: string;

  constructor(config?: { userDataDir?: string }) {
    this.userDataDir = config?.userDataDir || DEFAULT_PROFILE_DIR;
  }

  async connect(options: { headless?: boolean } = {}): Promise<void> {
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }

    console.log(`Starting browser (${options.headless ? 'headless' : 'visible'})...`);

    this.context = await chromium.launchPersistentContext(this.userDataDir, {
      headless: options.headless ?? false,
      viewport: { width: 1280, height: 800 },
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
      ],
    });

    // Close all existing pages (e.g., activity page tabs from previous sessions)
    const existingPages = this.context.pages();
    for (const page of existingPages) {
      await page.close();
    }

    // Create a fresh page to ensure clean state
    this._page = await this.context.newPage();
  }

  async disconnect(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this._page = null;
    }
  }

  get page(): Page {
    if (!this._page) throw new Error('Not connected - call connect() first');
    return this._page;
  }
}
