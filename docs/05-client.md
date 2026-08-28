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
permissions hook. Nothing else of the app is API. The typed portrait of that
barrel ships with `@deveye/types` (`src/sdk/client-ambient.d.ts`) and DevEye's
own CI checks the real barrel against it; this repo pulls it into the
standalone typecheck via one `include` entry in `tsconfig.json`.

## Data: declare, mutate, it refreshes

```ts
const api = featureApi(manifest);       // typed by your manifest's commands

function useCounter() {
    return useResource(
        'x-counter.state',                                    // your resource key
        () => api.send('x-counter.state', {}),
        'Le compteur est injoignable.'
    );
}
```

`useResource` re-runs on mount, on socket reconnect, and whenever the key is
invalidated. After one of your own writes, call `invalidate('x-counter.state')`
for an instant local refresh; other members get theirs through the live topic
(your `mutates: true` commands trigger it server-side). There is no polling
anywhere, and no cache to manage.

The card and the full view share the same hook, so they always agree.

A few escape hatches for less ordinary commands:

- `api.send(name, input, { timeoutMs: 30_000 })` stretches the wait for a
  command that queries a slow third party — the default socket timeout stays
  for everything else.
- A command that reads `'private'` data can answer `locked`. Wrap the call in
  `withSecrecy(() => api.send(...))` to retry once after the global unlock
  prompt, or read `useSecrecy()` and render locked rows as such (see
  [04-storage-and-encryption](04-storage-and-encryption.md)).
- The error a command rejects with is a `WsError` (exported by the barrel,
  `instanceof` works): `code` is the protocol code (`locked`, `forbidden`,
  `not_found`, `validation`, `conflict`, `timeout`...), `details` carries the
  validation breakdown when there is one. `humanizeError(e, fallback)` turns
  the common codes into a sentence; read `code` yourself when your feature
  knows better (Mail tells an expired mailbox authorization from a sealed
  session, and spells out which field a validation refused).
- `touchSecrecy()` keeps the unlocked session alive during a long operation
  the user is watching (a mailbox sync). `withSecrecy` already touches after
  every successful call, so most features never call it directly.

## Dialogs, popups and the other shared pieces

The barrel also carries the app's imperative dialog layer (`Popup`, driven by
`OpenPopup(id, input)`, which resolves with what `ClosePopup(id, result)`
passes), `DialogCancelButton` for a Dialog footer, `openInfo` for an "i"
explainer, `CountWidget` + `useWorkspaceCount` for a home card that shows a
plain count of one of your `.count` commands, and `useDragReorder`, the one
drag-and-drop reorder gesture of the app (a handle per row, an insertion bar
the hook positions itself). To put a face on "who did what" in a history
list, `useWorkspaceMembers()` returns the members of the active workspace as
the session lists them (empty before it answers, never `null`) and `Avatar`
renders one member's identity dot (their avatar, or their initial on their
account colour; `user` may be `undefined`, a deleted account must not break a
row). To paint something else in a member's colour (a dot in a legend, a
point on a chart), `userColorVar(color)` gives the CSS variable of an account
colour, the same one the live presence uses. Same rule as the rest: nothing
else of the app is API.

## Offering components to the host: `providers`

The client twin of a service's `providers`: an app screen sometimes composes a
module's components (Projects shows the availability strip of a linked Uptime
service). The contract is published in `@deveye/types/sdk` (a key in
`providers.ts`, the component types in `sdk/client.ts`); the module fills it
on its client entry, `providers: { [KEY]: {...} }`; the app looks it up at
render time and degrades cleanly when the module is absent. Like the server
side, you can only fill a contract the host already knows.

## The widget

No props, half the size, seconds of attention: show the one number or line
that makes the card worth placing. `manifest.tile.compact` halves its height
if that suits it.

## The topbar mini-widget (optional)

Declare `topbarWidget: { description: '...' }` in the manifest and export a
`TopbarWidget` component from the client entry: members can then pin it to the
navbar, next to the native status widgets. It renders inside the host's status
chip (frame and tooltip provided), so keep it to a glyph and a number.

It receives **no props, on purpose**: that is the security contract. The host
hands it nothing (no other feature's data, no workspace internals); everything
it shows must come through your own feature's commands, which the server
authorizes against the caller's grants. The host also only offers and mounts
it for members whose role grants your feature. Freedom inside the box, nothing
outside it.

## The full view

Opened when the card expands. `cacheDurationMinutes` decides how long it stays
mounted (state preserved) after closing: `0` unmounts immediately, omit for
forever. `holdSecrecy: true` keeps the password-encryption session alive while
open, if you read `'private'` data.

Two hooks into the host from there: `openFeature(feature, itemId?)` opens
another feature of the active workspace, on one of its items when `itemId` is
given (the host's teleport, for a "see this project" link), and
`useRequestPopupWidth(px | null)` asks the feature popup for a wider frame
while the calling component is mounted (a table explorer in expanded mode).
When two sticky bands stack (a detail header, then a period bar under it),
`useStickyOffset<T>()` measures the top one: put its `ref` on that band and its
`style` on a common ancestor, and the lower band reads `--sticky-head` for its
`top` (falling back to `0px` where there is no band above).

## Styles

CSS modules, with DevEye's design tokens (`var(--accent)`, `var(--space-sm)`,
`var(--text-secondary)`...): your feature follows the user's theme for free.
Never hard-code colors. Commit the `.d.ts` next to your `.module.css`.
