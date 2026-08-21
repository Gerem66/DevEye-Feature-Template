import type { FeatureManifest } from 'deveye-types/sdk';

import { countdownCommands } from './contracts/commands';

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
    id: 'x-countdown',
    label: 'Countdown',
    description: 'Deadlines with a shared countdown, and a notification when one lands.',
    /** Ships as assets/icons/hourglass.svg; DevEye copies and namespaces it. */
    icon: 'hourglass',
    category: 'daily',

    /** Opens the Notifications settings tab and the channels grant in roles. */
    notifies: true,
    hasItems: false,
    shareTier: 'never',

    /** One resource key: what `useResource` caches and the live topic refreshes. */
    resources: ['x-countdown.list'],

    settings: { feature: ['general'] },

    /**
     * A permission this feature defines beyond read/write. It appears in every
     * role editor under the feature's row; absent from a grant = denied, the
     * workspace owner always has it.
     */
    extraPermissions: [
        {
            key: 'manageDeadlines',
            label: 'Add and remove deadlines',
            description: 'Without it, write access only lets a member edit their own private notes.',
            type: 'toggle'
        }
    ],

    /** Native features this module calls through `ctx.deveye`. Undeclared = forbidden. */
    nativeCapabilities: ['notify'],

    commands: countdownCommands
} satisfies FeatureManifest;
