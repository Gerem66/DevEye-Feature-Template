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

A panel receives `{ scope, canWrite }` and renders inside the shell (which
owns the title, nav and sizing):

```tsx
export default function GeneralPanel({ scope, canWrite }: SettingsPanelProps) {
    ...
}
```

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
