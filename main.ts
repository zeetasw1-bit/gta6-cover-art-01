// Vice Cover Studio — the entry program for make.fun's gta6-cover-art-01.
//
// Node 22, standard library only. It takes this repository's app/ and
// screenshots/ and hands them to the grader: both folders are copied into
// the output directory (MAKEFUN_OUTPUT_DIR outside the grader, /output
// inside it) and /output/dossier.json is written with buildDossier from
// the vendored make.fun library, so the judge reads exactly the files
// that were committed.
//
// Run it locally first:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// The repository root is the folder this file lives in.
const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });

// The whole static app: HTML, CSS, modules, fonts and sample photos.
cpSync(join(repoRoot, 'app'), join(outputDir, 'app'), { recursive: true });

// The screenshots, when the folder exists (it always does in this repo).
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own: the text budget shapes the dossier's
// bytes, the rest refuse an entry the scorer would refuse anyway — more
// than four screenshots or one over 256 KiB, more than 993 files or
// 48 MiB under app/, or an app/ path over 1000 bytes.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(outputDir, 'dossier.json'), dossier);
