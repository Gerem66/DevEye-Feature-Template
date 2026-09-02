# Settings panels

All configuration in DevEye goes through **one** shell: a dialog with a left
nav, opened by one standard button. Your feature never builds its own settings
popup; it declares tabs and provides panels.

## Declaring tabs

```ts
// manifest
settings: {
    feature: ['general', 'sources', { id: 'advanced', label: 'Advanced', icon: 'settings' }],
    item: ['general', 'sync', 'encryption']        // only if hasItems
}
```

A custom tab may add `requiresWrite: true`. See "Without write access" below:
it is for a tab holding nothing but gestures, and it removes the tab rather
than rendering it inert.

- `'general'` and `'sources'` (and any custom tab) need a **panel component**
  from your client entry, keyed by the tab id:
    ```ts
    settingsPanels: { general: GeneralPanel, sources: SourcesPanel, advanced: AdvancedPanel }
    ```
- `'notifications'` is **fully generic**: if your manifest says
  `notifies: true`, DevEye renders the whole channels-and-routing tab for you.
  You write nothing.
- `'sync'` (item scope only) is the cadence and maintenance of an item your
  feature keeps fresh in the background (Mail: how often a mailbox is polled,
  pausing it, rebuilding a folder's cache). You provide `settingsPanels.sync`.
- `'encryption'` (item scope only) is where an item chooses the form of its
  own data when your feature leaves the choice (Backup: sealed or plain
  archives, per job; Mail: the open or guarded tier of a mailbox). The shell
  names and places the tab; you provide `settingsPanels.encryption`.

## Writing a panel

A panel receives `{ scope, canWrite, close, gone }` and renders inside the
shell (which owns the title, nav and sizing):

```tsx
export default function GeneralPanel({ scope, canWrite }: SettingsPanelProps) {
    ...
}
```

`close()` dismisses the dialog and nothing more, for a gesture best followed
on the screen underneath (a full resync whose progress the item's view draws).
`gone()` says the item being configured no longer exists here: it was deleted,
or moved to another workspace. The shell closes, then the view that opened it
leaves the item. Call it right after the delete command succeeds, and only
then invalidate your resources: a detail view reloaded before it leaves would
look for an item that is no longer there. Everything else applies in place.

## An item is edited in its General tab

There is no "Edit" dialog next to the settings button of an item. What a
creation dialog asks for lives, once the item exists, in its General settings
tab: the same fields, a `SaveButton`, and the delete action at the bottom
behind a `ConfirmDialog`, calling `gone()`. The creation dialog only creates.
An identity that cannot change afterwards (a repository's `owner/repo`) is
shown, not edited, with a line saying why. One door to change a thing, and the
same door in every feature.

`scope` is `{ kind: 'feature' }` or `{ kind: 'item', itemId, itemLabel }`.
The item id is **text**, whatever key your own table uses: a row-keyed feature
reads it back with `Number(scope.itemId)`, a UUID-keyed one (DevEye's own
Devices module) takes it as it stands. One component may serve both scales of
the same tab (the Devices panels show the terminal preferences at feature scale
and a device's collection config at item scale): branch on `scope.kind`. The
shell's own sections (sharing, permissions) follow the same text id;
notification routes keep a numeric key of their own, so they are only offered
to a feature whose items are numbered.

Use `settingsStyles` (from `deveye-sdk-client`) for the canonical rows:
`section`, `sectionLabel`, `sectionHint`, `field`, `fieldLabel`, `channelRow`,
`channelText`, `rowAction`... They are what makes every feature's settings
look like the same product.

## Without write access

Render read-only when `canWrite` is false; never hide the information itself.
Disable the inputs, drop the save button, and say why with `ReadOnlyNotice`
(from `deveye-sdk-client`) in its place:

```tsx
canWrite ? (
    <div className={shell.sectionActions}>
        <SaveButton onSave={save} />
    </div>
) : (
    <ReadOnlyNotice>
        Votre rôle ne permet pas de modifier ces réglages : ils relèvent de l’écriture sur X-Counter.
    </ReadOnlyNotice>
);
```

One component rather than a class, so the refusal reads the same in every
feature, lock glyph included. Anything blocked for another reason (an archived
device, an item that cannot be projected) keeps its own wording: the lock means
"your role", nothing else.

The exception is a tab holding **nothing but gestures**: read-only, it would be
an empty tab carrying an apology. Declare it `requiresWrite: true` in the
manifest and the shell drops it entirely, so your panel has no read-only case
to write. A tab that shows values is never in that case; the values are worth
reading.

## The button

Inside your full view, mount the standard button where actions live:

```tsx
<FeatureSettingsButton scope={{ kind: 'feature', feature: 'x-counter' }} />
```

It renders nothing when no tab is readable for the caller; that rule lives in
the shell, not in your code.

On an item's detail view, pass `onGone` too, the same handler as its back
button: the shell calls it once the item was deleted or moved away from inside
the settings, and the view returns to its list.

```tsx
<FeatureSettingsButton
    scope={{ kind: 'item', feature: 'x-counter', itemId: String(id), itemLabel: name }}
    onGone={onBack}
/>
```
