# Quotas and the account menu

## Quotas

A DevEye instance may bound what an account creates (a hosted plan). You never
see the plan: you declare what you count, and you ask before creating.

```ts
// manifest.ts
quotas: [{ key: 'reports', label: 'reports per month' }],
```

A manifest declares at most 8 quotas (`MAX_FEATURE_QUOTAS`); the plan names
each one `<featureId>.<key>`.

```ts
// server entry: how the host counts it, for the screens
quotas: {
    reports: { count: (repo, ownerWorkspaceIds) => repo.countThisMonth(ownerWorkspaceIds) }
},
```

```ts
// the handler that creates
await ctx.quota.assert('reports', async (ownerWorkspaceIds) => {
    return (await ctx.repo.countThisMonth(ownerWorkspaceIds)) + 1;
});
await ctx.repo.create(input);
```

- The account is the **owner of the workspace of the call**, not the caller: in
  a shared workspace, what a member creates counts against its owner. That is
  why the counter receives every workspace this owner owns.
- The counter is **never called when unlimited**, and everything is unlimited
  on an instance with no plan provider (a self-hosted DevEye).
- Beyond the limit the host throws `quota_exceeded` and the client shows its own
  upgrade prompt: you handle nothing. A limit of 0 (a feature the free plan
  leaves out) opens its "available with the Pro offer" variant; a screen that
  already knows it (`ctx.quota.limit(key)` read into a resource) opens that
  same prompt itself with `openProOffer({ body })`, before sending.
- Nothing is ever deleted. When a limit drops, a flow quota refuses the next
  use, and a stock quota pauses what goes beyond it (below).
- Under heavy load, the administrator may serve paying accounts first: every
  limit of the others then reads 0, so their stock pauses and their creations
  are refused until the mode ends. Nothing to do on your side, the same paths
  apply.
- `ctx.quota.limit(key)` reads the plan's ceiling for one key: `null` when
  unlimited, `0` while the host serves priority accounts first and the owner
  is not one. An undeclared key throws `validation`.
- `ctx.quota.usage(key)` reads where the owner stands, `{ used, limit }` counted
  by your `server.quotas[key]`, or `null` when unlimited (then nothing is
  counted): what a screen says as "3 of 5" before the refusal. Count with the
  same repo function in `assert`, so the screen and the refusal agree.
- `ctx.quota.paid()` (and `deps.quotaFor(ws).paid()`) tells whether the owner
  pays: a paid or trial plan, a plan granted on the paid tier, an
  administrator, or no plan provider at all (a self-hosted instance). Key a
  default that costs the host on it (a probe cadence: every minute when paid,
  every five otherwise), never a refusal: refusals go through `limit` and
  `assert`.
- Every quota needs its counter: the boot refuses a module whose
  `server.quotas` does not follow its manifest. A flow gives `count`, a stock
  gives `list` (below), and a `perOperation` quota gives nothing.

### Stock quotas: pausing what goes beyond

A quota is a **flow** when you check it at each use (events per month, the
bytes held): its `count` is all it needs. It is a **stock** when what it counts
exists and costs while it exists (a probed monitor, a paired agent). Mark it,
and list what it counts, oldest first, under the very WHERE of your counter:
that list is also its count, so a stock gives `list` and never `count`.

```ts
// manifest.ts
quotas: [{ key: 'monitors', label: 'monitors', stock: true }],

// server entry
quotas: {
    monitors: { list: (repo, ownerWorkspaceIds) => repo.stockIn(ownerWorkspaceIds) }
},
// repo: SELECT id, workspace_id FROM ... WHERE workspace_id IN (?) ORDER BY created, id
```

When the owner's plan drops below what exists, the host pauses the most recently
created ones and resumes them once the limit rises or a slot frees. You never
write that state, and never touch your own user switch (`enabled`...) for it:
resuming gives the user back their own setting. A paused item stays readable,
editable and deletable, and **nothing of it runs**:

- exclude `ctx.quota.paused(key)` (or `deps.pauses.paused(key)`) **in the SQL**
  of your due lists (`id NOT IN (?)`, guard the empty list). Filtering after a
  `LIMIT` would let paused items, whose timestamps never advance, starve the
  others;
- call `await ctx.quota.assertActive(key, id)` before any on-demand run (check
  now, sync now): it opens the plan prompt for a paused item;
- `isPaused(key, id)` is a synchronous in-memory read: check it after any cache
  of yours, and a public page of a paused item answers like an unpublished one;
- `onPlanPause({ key, paused, resumed })` on your service is only for what you
  hold open (a connection, a session, a timer);
- show `PlanPausedBadge` on a paused item and `PlanPausedNotice` above its list
  (`deveye-sdk-client`).

A quota may measure bytes instead of things: `{ key: 'storage', label: 'of
storage', unit: 'bytes' }`. The plan's limit is then in bytes and the refusal
reads as a size. For what is created outside any command (bytes an agent
uploads), a service asks the same way with `deps.quotaFor(workspaceId)`.

A limit that bounds ONE operation (the size of one file to convert) accumulates
nothing: declare it `perOperation: true`, give it no `server.quotas` entry, and
`ctx.quota.usage` refuses it. It is never a stock.

In tests: `createTestContext({ quotaLimits: { monitors: 5 }, ownerWorkspaceIds: [1, 2], quotas: serverEntry.quotas })`,
and `createTestServiceDeps({ quotaLimits: { storage: 1024 }, quotas: serverEntry.quotas })` for `quotaFor`.
`quotas` is what `quota.usage` counts through. Both take `pausedItems: { monitors: ['7'] }` for the plan pauses.

## An entry in the user menu

For what belongs to an account rather than to a workspace:

```ts
// manifest.ts
accountEntry: { label: 'Subscription' }, // drawn with your manifest icon
accountOnly: true, // no card, no row in the roles screen
```

```tsx
// client entry
export const clientEntry: FeatureClient = { AccountView };
```

`AccountView` receives `close()`, `isAdmin` (a global administrator is viewing)
and, once, the `hint` a sign-up carried when you declare
`accountEntry.signupHint`. An `accountOnly` module declares
`access: { scope: 'account' }` on every command: the host runs them in the
caller's personal workspace, whatever workspace is displayed. A module that
serves the instance rather than its members (lists the moderators keep) may
drop `accountEntry` too and declare `adminTabs` alone: it then exists only in
the feature administration popup.

- `'accounts.read'` gives `ctx.deveye.accounts.me()` in a handler and
  `deps.accounts.find / findByEmail / list / search / all` in a service. `search`
  matches a substring of the username or the email (an all-digit query also
  matches that account id, listed first) and returns at most 50 accounts; `all`
  returns every account, oldest first, for an administrator's screen you gate
  yourself. `SdkAccount.suspended` says an administrator suspended it.
- `'accounts.usage'` reads what an account uses of every limit of the instance,
  every feature included: `{ kind, used, paused }` (`kind`: stock, flow or per-operation) by `<featureId>.<quotaKey>`, over
  the workspaces it owns (`used` is `null` for a per-operation limit). In a
  handler, `ctx.deveye.usage.of(userId)` answers the caller's own, or anyone's
  for a global administrator; `ofMany(userIds)` is an administrator's sweep,
  paced by the host. A service reads the same through `deps.usage`. What a plan
  provider shows beside the limits it sets; tests pass `accountUsage`.
- `'accounts.mail'` gives `deps.accountMail.send(userId, message)` in a
  service: one email to that account's own address (never another), from the
  server's sender. Give plain text (`subject`, `paragraphs`, an optional
  framed `notice`, `button` and `footnote`); DevEye lays it out and escapes it.
  It resolves the address it went to, for your records, and retries nothing:
  a refusal rejects, so record what went out and try the rest on your next
  tick. `configured` is `false` on a server without SMTP, where `send` throws
  `conflict`. Keep it to what the account must receive (a renewal notice, a
  receipt): it never agreed to anything else.
- `deps.accountMail.sendToModerators(message)` writes the same kind of email
  to every active moderator and administrator of the DevEye, for what awaits
  their decision (a report of illicit content on a public page). A moderator
  never learns where a report came from: leave the reporter's address and IP
  out of the message. It resolves the addresses reached, empty when there is
  no one.
- `onAccountDeleted(userId)` on your service runs before an account is
  deleted with everything it owns: end what you hold for it elsewhere (a
  subscription with a payment provider). It may return `{ paragraph }`, one
  sentence of yours in the confirmation email the holder receives once the
  account is gone. A throw aborts the deletion, so never throw for a
  throwaway account of the end-to-end runner (`SdkAccount.e2e`): clean up and
  log instead.
- `ctx.live.accountChanged(userId)` (or `deps.live.accountChanged`) makes that
  account's open clients re-fetch your resources, wherever they sit.
- `openAccountView()`, `openProOffer()` and `useAccountPlan()` are exported by the
  client SDK.

## Administration tabs

For what the operator of the instance handles across accounts (reports to
moderate, a queue to watch), `adminTabs` adds your tabs to the feature
administration popup, "Modération" in the account menu. A feature with a
`moderation` tab is listed apart, at the top. A global administrator sees every
feature there, each with the overview the host draws and then your tabs; a
moderator sees only the features with a `moderation` tab, and only those tabs.

```ts
// manifest.ts
adminTabs: [{ id: 'reports', label: 'Reports', moderation: true }],
```

```tsx
// client entry
export const clientEntry: FeatureClient = { Widget, Full, AdminTabs: { reports: Reports } };
```

- Each tab id (the shape of an extra permission key) has its component in
  `FeatureClient.AdminTabs`, without props. The popup draws the header (your
  feature, its tabs): draw no title and no sticky header of your own, and no
  scrolling container; your content sits right under the tabs. A filter that
  governs one block sits on that block's heading row.
- A `moderation` tab opens to moderators as well as to global administrators,
  and every command it sends declares
  `access: { scope: 'account', moderation: true }`. Any other tab is for global
  administrators only, its commands declaring
  `access: { scope: 'account', admin: true }`. The host enforces both before
  your handler runs.
- `ctx.isAdmin` stays `false` for a moderator. What only an administrator may
  read (who filed a report: their address, their IP) is left out on the
  server, the output schema declaring those fields nullable, and the tab shows
  them only when present.
- `server.adminPending({ repo, pauses })` answers, by tab id, how many things
  await a human decision (open reports, a queue running late): the live badges
  of the account menu, of your feature in the popup and of the tab. Cheap
  counts only; a tab absent or at 0 lights nothing. `pauses` holds your paused
  `stock` items, whatever the workspace.
- Whenever that count may have moved, call `ctx.live.pendingChanged()` in a
  handler (a report decided) or `deps.live.pendingChanged()` in a service or a
  public route (a report just filed, a ticker finding a queue late). The host
  counts again, coalesced, and relights the badges of every moderator and
  administrator connected. The beat travels on the native topic `pending`:
  declare `alsoInvalidatedBy: [{ topic: 'pending', keys: ['x-demo.reports'] }]`
  and a decision taken by one moderator refreshes the list on the others'
  screens.
- `server.adminFacts({ repo, pauses })` answers your own figures for the
  overview, across every account: `{ label, value, unit: 'count' | 'bytes' }[]`
  (links created, bytes stored). The host counts the rest itself: the
  workspaces whose home has your card, their members, the size of your tables,
  your quotas.
- `/?moderation=<your module id>` opens the reader's popup on your feature on
  arrival: the button of a report mail sent with
  `accountMail.sendToModerators`.

## Webhooks

A public route may ask for the undecoded body, which a signature is computed
over:

```ts
app.post('/api/x-demo/webhook', { rawBody: true }, async (req, reply) => {
    verify(req.rawBody, req.headers['x-signature']);
});
```
