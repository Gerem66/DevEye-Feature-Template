import type { FeatureManifest } from '@deveye/types/sdk';

import { counterCommands } from './contracts/commands';

/**
 * The manifest: everything DevEye needs to know about this feature, once.
 *
 * It drives the home-grid catalog, the settings dialog, the workspace role
 * editor, the live-invalidation bus and the command registry. Change a field
 * here and every screen follows; there is no second registration point.
 *
 * `satisfies` (not `:`) keeps the literal command names, which is what makes
 * `featureApi(manifest)` fully typed on the client.
 */
export const manifest = {
    /** `x-<slug>`: the prefix guarantees no collision with built-in features. */
    id: 'x-counter',
    label: 'Counter',
    description: 'A shared counter: one big button, the increment done server-side, every click journaled plain AND encrypted.',
    /** Ships as assets/icons/tally.svg; DevEye copies and namespaces it. */
    icon: 'tally',
    category: 'daily',

    /** Opens the Notifications settings tab and the channels grant in roles. */
    notifies: true,
    hasItems: false,
    shareTier: 'never',

    /** One resource key: what `useResource` caches and the live topic refreshes. */
    resources: ['x-counter.state'],

    settings: { feature: ['general'] },

    /**
     * A permission this feature defines beyond read/write. It appears in every
     * role editor under the feature's row; absent from a grant = denied, the
     * workspace owner always has it.
     */
    extraPermissions: [
        {
            key: 'reset',
            label: 'Reset the counter',
            description: 'Write access clicks; resetting wipes the value and its journal for everyone.',
            type: 'toggle'
        }
    ],

    /** Native features this module calls through `ctx.deveye`. Undeclared = forbidden. */
    nativeCapabilities: ['notify'],

    commands: counterCommands
} satisfies FeatureManifest;
