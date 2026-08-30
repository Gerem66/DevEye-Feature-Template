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

A panel receives `{ scope, canWrite, close }` and renders inside the shell
(which owns the title, nav and sizing):

```tsx
export default function GeneralPanel({ scope, canWrite }: SettingsPanelProps) {
    ...
}
```

`close()` dismisses the dialog. Reach for it in one case only: a panel that
deletes the very item it configures. The scope it was opened on no longer
exists, and the shell would otherwise fall back to the feature's own tabs,
still titled with the deleted item's name. Everything else applies in place.

`scope` is `{ kind: 'feature' }` or `{ kind: 'item', itemId, itemLabel }`.
The item id is a **number** for every row-keyed feature (the default); a
feature whose items are strings (DevEye's own Devices module: a device is a
UUID) types its panels `SettingsPanelProps<string>`. One component may serve
both scales of the same tab (the Devices `general` panel shows the terminal
preferences at feature scale and a device's collection config at item scale):
branch on `scope.kind`. The shell's own sections (sharing, permissions,
notifications) key their tables on the number and are never offered for a
string-keyed feature.

Use `settingsStyles` (from `deveye-sdk-client`) for the canonical rows:
`section`, `sectionLabel`, `sectionHint`, `field`, `fieldLabel`, `channelRow`,
`channelText`, `rowAction`... They are what makes every feature's settings
look like the same product. Render read-only when `canWrite` is false; never
hide the information itself.

## The button

Inside your full view, mount the standard button where actions live:

```tsx
<FeatureSettingsButton scope={{ kind: 'feature', feature: 'x-counter' }} />
```

It renders nothing when no tab is readable for the caller; that rule lives in
the shell, not in your code.
