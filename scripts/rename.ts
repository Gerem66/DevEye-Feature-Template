/**
 * One-shot rename after "Use this template": swaps the example's identity for
 * yours, everywhere it appears.
 *
 *   npx tsx scripts/rename.ts <slug> [Label]
 *
 * `<slug>` is lowercase letters and digits, e.g. `bookmarks`; the feature id
 * becomes `x-bookmarks`, the package `deveye-feature-bookmarks`, the tables
 * `ft_bookmarks_*`, and the example's `counter` / `Counter` identifiers follow
 * (`bookmarksCommands`, `BookmarksWidget`, `Bookmarks.tsx`). `Label` is the UI
 * title; it defaults to the capitalised slug.
 *
 * Everything the example says about ITSELF — its description, its README — is
 * yours to rewrite: the script leaves a short placeholder rather than a text
 * about a counter you never wrote.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];
const label = process.argv[3] ?? (slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : '');

if (!slug || !/^[a-z][a-z0-9]{1,24}$/.test(slug)) {
    console.error('usage: npx tsx scripts/rename.ts <slug> [Label]   (lowercase letters and digits)');
    process.exit(1);
}

const Slug = slug.charAt(0).toUpperCase() + slug.slice(1);

const files: string[] = [];
const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|json|md|yml|css)$/.test(entry.name)) files.push(full);
    }
};
walk(ROOT);

/**
 * Order matters: the longest forms first, so `deveye-feature-counter` is not
 * eaten by the bare `counter` rule that follows it.
 */
const RULES: [RegExp, string][] = [
    [/deveye-feature-counter/g, `deveye-feature-${slug}`],
    [/x-counter/g, `x-${slug}`],
    [/ft_counter_/g, `ft_${slug}_`],
    [/COUNTER_/g, `${slug.toUpperCase()}_`],
    [/\bCounter\b/g, Slug],
    [/\bcounter\b/g, slug]
];

let touched = 0;
for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const after = RULES.reduce((text, [from, to]) => text.replace(from, to), before);
    if (after !== before) {
        fs.writeFileSync(file, after);
        touched++;
    }
}

// The one file whose NAME carries the example's identity. Plain `rename`, not
// `git mv`: this script runs before your first commit.
const component = path.join(ROOT, 'src/client/Counter.tsx');
if (fs.existsSync(component)) fs.renameSync(component, path.join(ROOT, `src/client/${Slug}.tsx`));

// The UI label and the npm description talk about a counter: leaving them
// would ship a feature introducing itself as the example it came from.
const manifestPath = path.join(ROOT, 'src/manifest.ts');
fs.writeFileSync(
    manifestPath,
    fs
        .readFileSync(manifestPath, 'utf8')
        .replace(/label: '[^']*'/, `label: '${label}'`)
        .replace(/description:\n?\s*'[^']*'/, `description: 'TODO: one sentence about ${label}.'`)
);

const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { description: string };
pkg.description = `TODO: one sentence about ${label}.`;
fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

fs.writeFileSync(
    path.join(ROOT, 'README.md'),
    `# ${label}\n\nA DevEye feature module (\`x-${slug}\`). Built from\n[DevEye-Feature-Template](https://github.com/Gerem66/DevEye-Feature-Template),\nwhose \`docs/\` remain the SDK reference.\n\n\`\`\`bash\nnpm install\nnpm run ci\n\`\`\`\n\nInstall it into a DevEye checkout: see \`docs/01-concepts.md\`.\n`
);

console.log(
    `rename: ${touched} file(s) now carry x-${slug}. Rewrite the manifest description, the README and the example's screens.`
);
