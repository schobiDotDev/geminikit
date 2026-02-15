export class GeminiError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'GeminiError';
  }
}

export class AuthenticationError extends GeminiError {
  constructor(message: string = 'Not logged in to Google/Gemini') {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class GenerationError extends GeminiError {
  constructor(message: string = 'Image generation failed') {
    super(message, 'GENERATION_ERROR');
    this.name = 'GenerationError';
  }
}

export class BrowserError extends GeminiError {
  constructor(message: string) {
    super(`Browser error: ${message}`, 'BROWSER_ERROR');
    this.name = 'BrowserError';
  }
}

export function isGeminiError(error: unknown): error is GeminiError {
  return error instanceof GeminiError;
}

export function getErrorGuidance(error: unknown): string {
  if (!isGeminiError(error)) {
    return 'An unexpected error occurred. Please try again.';
  }

  switch (error.code) {
    case 'AUTH_ERROR':
      return `${error.message}

Recovery steps:
1. Clear browser profile: rm -rf ~/.geminikit/browser-profile
2. Run with headless=false to open browser for login
3. Log in to Google manually
4. Session will be saved for future headless use`;

    case 'GENERATION_ERROR':
      return `${error.message}

Recovery steps:
1. Check if Gemini is available at gemini.google.com
2. Try a different prompt (some content may be blocked)
3. Verify your Google account has access to Gemini`;

    case 'BROWSER_ERROR':
      return `${error.message}

Recovery steps:
1. Kill any stuck browser processes
2. Remove browser lock: rm -f ~/.geminikit/browser-profile/SingletonLock
3. Try again`;

    default:
      return error.message;
  }
}
