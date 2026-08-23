# Settings panels

All configuration in DevEye goes through **one** shell: a dialog with a left
nav, opened by one standard button. Your feature never builds its own settings
popup; it declares tabs and provides panels.

## Declaring tabs

```ts
// manifest
settings: {
    feature: ['general', 'sources', { id: 'advanced', label: 'Advanced', icon: 'settings' }],
    item: ['general']        // only if hasItems
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
