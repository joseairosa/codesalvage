/**
 * Image Generation Script for CodeSalvage
 *
 * Uses Google Gemini (Nano Banana) API to generate flat-minimal illustrations.
 * Run once, commit the resulting PNGs, serve as static assets.
 *
 * Usage:
 *   GEMINI_API_KEY=<key> npx tsx scripts/generate-images.ts
 *
 * Features:
 * - Skips images that already exist (idempotent)
 * - Sequential generation with retry + backoff for rate limits
 * - Saves to public/images/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_KEY = process.env['GEMINI_API_KEY'];
if (!API_KEY) {
  console.error('ERROR: GEMINI_API_KEY environment variable is required.');
  process.exit(1);
}

const MODEL = 'gemini-2.5-flash-image';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.resolve(__dirname, '..', 'public', 'images');

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 30_000; // 30 seconds base delay for rate limit retries

const STYLE_PREFIX =
  'modern flat illustration, tech/developer theme, blue and purple gradient palette (#2563eb to #9333ea), clean minimal style, no text in image, white background,';

interface ImageManifest {
  filename: string;
  prompt: string;
}

const IMAGES: ImageManifest[] = [
  {
    filename: 'hero-illustration.png',
    prompt: `${STYLE_PREFIX} a developer sitting at a desk with floating code editor windows and a half-built app interface around them, creative energy sparks, wide composition`,
  },
  {
    filename: 'step-list.png',
    prompt: `${STYLE_PREFIX} a developer uploading code to the cloud, project cards floating upward from a laptop, upload arrow, square composition`,
  },
  {
    filename: 'step-connect.png',
    prompt: `${STYLE_PREFIX} two developers connected by chat bubbles, a handshake over source code, collaboration, square composition`,
  },
  {
    filename: 'step-secure.png',
    prompt: `${STYLE_PREFIX} a shield protecting a financial transaction, lock with checkmark, coins and a credit card, security concept, square composition`,
  },
  {
    filename: 'step-download.png',
    prompt: `${STYLE_PREFIX} a developer downloading a code package, zip file with a downward arrow, code snippets flowing out, square composition`,
  },
  {
    filename: 'step-complete.png',
    prompt: `${STYLE_PREFIX} a developer launching a rocket from a laptop, celebration confetti, project completion concept, square composition`,
  },
  {
    filename: 'step-price.png',
    prompt: `${STYLE_PREFIX} a price tag attached to source code, dollar sign, valuation gauge, code with monetary value concept, square composition`,
  },
  {
    filename: 'step-earn.png',
    prompt: `${STYLE_PREFIX} money flowing toward a developer, revenue dashboard with charts going up, earnings concept, square composition`,
  },
  {
    filename: 'empty-projects.png',
    prompt: `${STYLE_PREFIX} a magnifying glass hovering over an empty folder, search concept, no results, clean and simple, square composition`,
  },
  {
    filename: 'empty-messages.png',
    prompt: `${STYLE_PREFIX} an empty speech bubble next to a quiet mailbox, no messages concept, peaceful, square composition`,
  },
  {
    filename: 'placeholder-project.png',
    prompt: `${STYLE_PREFIX} a generic code editor window with abstract colorful code lines, tech pattern background, 3:2 aspect ratio`,
  },
  {
    filename: 'cta-illustration.png',
    prompt: `${STYLE_PREFIX} a group of diverse developers collaborating around a large screen, community and teamwork, wide composition`,
  },
  {
    filename: 'logo.png',
    prompt: `${STYLE_PREFIX} a logomark icon: a recycling symbol made of code angle brackets < > and curly braces { }, blue to purple gradient, simple bold design, no text, centered on white background, square composition`,
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateImage(manifest: ImageManifest): Promise<Buffer | null> {
  const body = {
    contents: [
      {
        parts: [{ text: manifest.prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (response.status === 429) {
      if (attempt < MAX_RETRIES) {
        const waitSec = (BASE_DELAY_MS * (attempt + 1)) / 1000;
        console.error(`       Rate limited. Waiting ${waitSec}s before retry ${attempt + 1}/${MAX_RETRIES}...`);
        await sleep(BASE_DELAY_MS * (attempt + 1));
        continue;
      }
      console.error(`       Rate limited after ${MAX_RETRIES} retries`);
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  API error (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();

    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) {
      console.error('  No candidates in response');
      return null;
    }

    const parts = candidates[0].content?.parts;
    if (!parts) {
      console.error('  No parts in response');
      return null;
    }

    for (const part of parts) {
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, 'base64');
      }
    }

    console.error('  No image data found in response parts');
    return null;
  }

  return null;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Generating ${IMAGES.length} images using model: ${MODEL}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < IMAGES.length; i++) {
    const manifest = IMAGES[i]!;
    const outputPath = path.join(OUTPUT_DIR, manifest.filename);

    if (fs.existsSync(outputPath)) {
      console.log(`[SKIP] ${manifest.filename} (already exists)`);
      skipped++;
      continue;
    }

    console.log(`[GEN]  ${manifest.filename} (${i + 1}/${IMAGES.length}) ...`);

    try {
      const imageBuffer = await generateImage(manifest);

      if (imageBuffer) {
        fs.writeFileSync(outputPath, imageBuffer);
        const sizeKB = (imageBuffer.length / 1024).toFixed(1);
        console.log(`       Done (${sizeKB} KB)`);
        generated++;
      } else {
        console.error(`       FAILED - no image data returned`);
        failed++;
      }
    } catch (error) {
      console.error(`       FAILED -`, error instanceof Error ? error.message : error);
      failed++;
    }

    // Delay between requests to avoid rate limiting
    if (i < IMAGES.length - 1) {
      console.log('       Waiting 5s before next request...');
      await sleep(5000);
    }
  }

  console.log(`\nDone: ${generated} generated, ${skipped} skipped, ${failed} failed`);

  if (failed > 0) {
    console.log('\nRe-run the script to retry failed images.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
