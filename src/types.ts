export interface GeminiConfig {
  /** Browser profile directory (default: ~/.geminikit/browser-profile) */
  userDataDir?: string;
}

export interface GenerateImageOptions {
  /** Run browser headless (default: true) */
  headless?: boolean;
  /** Aspect ratio hint in the prompt, e.g. "16:9", "1:1" */
  aspectRatio?: string;
  /** Timeout for image generation in ms (default: 120000) */
  timeout?: number;
}

export interface ImageResult {
  imagePath: string;
  width: number;
  height: number;
}
