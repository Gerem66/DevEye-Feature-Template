# Client

Your client entry exports three things:

```ts
export const clientEntry: FeatureClient = {
    Widget,                 // the card body on the grid: NO props
    Full,                   // the expanded view: receives { closeFeature }
    settingsPanels: {...},  // one panel per settings tab that needs one
    cacheDurationMinutes: 10
};
```

Everything imports from **`deveye-sdk-client`**: the UI kit (Button, Dialog,
TextInput, SegmentedControl...), the data hooks, the live hooks, the
permissions hook. Nothing else of the app is API; this repo types the module
in `types/deveye-sdk-client.d.ts` for standalone typecheck.

## Data: declare, mutate, it refreshes

```ts
const api = featureApi(manifest);       // typed by your manifest's commands

function useCountdowns() {
    return useResource(
        'x-countdown.list',                                   // your resource key
        async () => (await api.send('x-countdown.list', {})).countdowns,
        'Deadlines could not be loaded.'
    );
}
```

`useResource` re-runs on mount, on socket reconnect, and whenever the key is
invalidated. After one of your own writes, call `invalidate('x-countdown.list')`
for an instant local refresh; other members get theirs through the live topic
(your `mutates: true` commands trigger it server-side). There is no polling
anywhere, and no cache to manage.

The card and the full view share the same hook, so they always agree.

## The widget

No props, half the size, seconds of attention: show the one number or line
that makes the card worth placing. `manifest.tile.compact` halves its height
if that suits it.

## The full view

Opened when the card expands. `cacheDurationMinutes` decides how long it stays
mounted (state preserved) after closing: `0` unmounts immediately, omit for
forever. `holdSecrecy: true` keeps the password-encryption session alive while
open, if you read `'private'` data.

## Styles

CSS modules, with DevEye's design tokens (`var(--accent)`, `var(--space-sm)`,
`var(--text-secondary)`...): your feature follows the user's theme for free.
Never hard-code colors. Commit the `.d.ts` next to your `.module.css`.
