/**
 * One-shot rename after "Use this template": swaps the example's identity for
 * yours, everywhere it appears (package name, feature id, command prefixes,
 * resource keys).
 *
 *   npx tsx scripts/rename.ts <slug>
 *
 * `<slug>` is lowercase letters and digits, e.g. `bookmarks`; the feature id
 * becomes `x-bookmarks` and the package `deveye-feature-bookmarks`. Rename
 * component files and labels yourself afterwards; this script only handles the
 * identifiers that must stay consistent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const slug = process.argv[2];

if (!slug || !/^[a-z][a-z0-9]{1,24}$/.test(slug)) {
    console.error('usage: npx tsx scripts/rename.ts <slug>   (lowercase letters and digits)');
    process.exit(1);
}

const files: string[] = [];
const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx|json|md|yml)$/.test(entry.name)) files.push(full);
    }
};
walk(ROOT);

let touched = 0;
for (const file of files) {
    const before = fs.readFileSync(file, 'utf8');
    const after = before
        .replaceAll('x-countdown', `x-${slug}`)
        .replaceAll('deveye-feature-countdown', `deveye-feature-${slug}`)
        .replaceAll('ft_countdown_', `ft_${slug}_`);
    if (after !== before) {
        fs.writeFileSync(file, after);
        touched++;
    }
}
console.log(`rename: ${touched} file(s) now carry x-${slug}. Update labels, components and docs text yourself.`);
