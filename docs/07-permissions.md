# Permissions

Three layers, all granted per role in the workspace's role editor, all
resolved before your handler runs.

## 1. The built-in axis: none / read / write

Absent from a grant = the feature does not exist for that member (no card, no
commands). `read` lets them see; `write` implies read. Declare the level per
command:

```ts
access: { level: 'write' }        // 'read' is the default
```

## 2. Channels (if you notify)

`notifies: true` gives every role a "manage this feature's alert channels"
checkbox. You never check it yourself: the generic notifications tab and the
`notify.*` commands enforce it.

## 3. Your own extras

Declare up to 4 permissions in the manifest; they appear under your feature's
row in every role editor, rendered by DevEye:

```ts
extraPermissions: [
    { key: 'reset', label: '...', description: '...', type: 'toggle' },
    { key: 'exportScope', label: '...', description: '...', type: 'choice',
      options: [{ value: 'own', label: '...' }, { value: 'all', label: '...' }],
      default: 'own', ownerValue: 'all' }
]
```

Two bounded types only. The semantics are fail-closed and non-negotiable:

- `toggle`: absent from the grant = **false**. The workspace owner = true.
- `choice`: absent = `default`, which MUST be the least-privileged option.
  The owner = `ownerValue`.

Enforce them declaratively (`access: { extras: ['reset'] }`, all
required) or imperatively (`ctx.canExtra('reset')`,
`ctx.extraValue('exportScope')`) when the answer shapes the result instead of
gating the command.

## The one rule to never forget

**The UI hides, the server authorizes.** Client-side checks
(`useWorkspacePermissions().canExtra(...)`) exist so members do not see
buttons that would fail; they protect nothing. Every command is re-checked
server-side, on rights resolved from the role, whatever the client sent.
