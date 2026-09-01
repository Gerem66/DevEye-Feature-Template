/**
 * Standalone validation, run by CI before your feature ever meets an app:
 *  - the manifest passes `validateManifest` (id shape, command and resource
 *    prefixes, extras, tabs coherence);
 *  - `deveye-feature.json` agrees with it (same id, icons shipped, tables
 *    allowlist);
 *  - migration files, if any, only touch `ft_<slug>_` tables;
 *  - the three places that state a `@deveye/types` version agree.
 *
 * DevEye runs the same checks again at install time (`npm run gen:features`);
 * failing here is just failing earlier, on your side of the fence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateManifest } from '@deveye/types/sdk';

import { manifest } from '../src/manifest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message: string): never {
    console.error(`validate: ${message}`);
    process.exit(1);
}

validateManifest(manifest);

const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'deveye-feature.json'), 'utf8')) as {
    id: string;
    tables?: string[];
    icons?: string[];
    minTypesVersion?: string;
};
if (meta.id !== manifest.id) fail(`deveye-feature.json.id (${meta.id}) != manifest.id (${manifest.id})`);

for (const icon of meta.icons ?? []) {
    const file = path.join(ROOT, 'assets', 'icons', `${icon}.svg`);
    if (!fs.existsSync(file)) fail(`declared icon missing: assets/icons/${icon}.svg`);
}
if (!(meta.icons ?? []).includes(manifest.icon)) {
    console.warn(
        `validate: manifest.icon "${manifest.icon}" is not shipped; it must then match an existing DevEye icon class.`
    );
}

const slug = manifest.id.replace(/^x-/, '');
const prefix = `ft_${slug}_`;
const migrationsDir = path.join(ROOT, 'src', 'server', 'migrations');
if (fs.existsSync(migrationsDir)) {
    const ddl = [
        /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([A-Za-z0-9_]+)/gi,
        /ALTER\s+TABLE\s+[`"]?([A-Za-z0-9_]+)/gi,
        /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?[`"]?([A-Za-z0-9_]+)/gi,
        /CREATE\s+(?:UNIQUE\s+)?INDEX\s+\S+\s+ON\s+[`"]?([A-Za-z0-9_]+)/gi
    ];
    const allowed = new Set(meta.tables ?? []);
    for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        for (const re of ddl) {
            for (let m = re.exec(sql); m !== null; m = re.exec(sql)) {
                if (!m[1].startsWith(prefix) && !allowed.has(m[1])) {
                    fail(`${file} touches "${m[1]}", outside the ${prefix} prefix`);
                }
            }
        }
    }
}

/**
 * Three files state a `@deveye/types` version — `minTypesVersion`, the peer
 * range, and what is installed — and nothing keeps them in step. A module that
 * calls an SDK newer than the floor it declares installs fine and breaks on the
 * host that took the floor at its word.
 */
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
    peerDependencies?: Record<string, string>;
};
const installedPath = path.join(ROOT, 'node_modules', '@deveye', 'types', 'package.json');
if (meta.minTypesVersion && fs.existsSync(installedPath)) {
    const installed = (JSON.parse(fs.readFileSync(installedPath, 'utf8')) as { version: string }).version;
    if (compareVersions(installed, meta.minTypesVersion) < 0) {
        fail(`@deveye/types ${installed} is older than deveye-feature.json.minTypesVersion (${meta.minTypesVersion})`);
    }
}
const peer = pkg.peerDependencies?.['@deveye/types'];
const floor = peer?.match(/(\d+\.\d+\.\d+)/)?.[1];
if (meta.minTypesVersion && floor && floor !== meta.minTypesVersion) {
    console.warn(
        `validate: peerDependencies says ${peer} but minTypesVersion says ${meta.minTypesVersion} — pick one floor.`
    );
}

/** Numeric compare of two `x.y.z` versions. Enough: no pre-release here. */
function compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
    }
    return 0;
}

console.log(`validate: OK (${manifest.id}, ${manifest.commands.length} commands)`);
