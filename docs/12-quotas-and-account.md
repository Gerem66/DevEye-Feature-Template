# Quotas and the account menu

## Quotas

A DevEye instance may bound what an account creates (a hosted plan). You never
see the plan: you declare what you count, and you ask before creating.

```ts
// manifest.ts
quotas: [{ key: 'monitors', label: 'monitors' }],
```

```ts
// the handler that creates
await ctx.quota.assert('monitors', async (ownerWorkspaceIds) => {
    return (await ctx.repo.countIn(ownerWorkspaceIds)) + 1;
});
await ctx.repo.create(input);
```

- The account is the **owner of the workspace of the call**, not the caller: in
  a shared workspace, what a member creates counts against its owner. That is
  why the counter receives every workspace this owner owns.
- The counter is **never called when unlimited**, and everything is unlimited
  on an instance with no plan provider (a self-hosted DevEye).
- Beyond the limit the host throws `quota_exceeded` and the client shows its own
  upgrade prompt: you handle nothing.
- Only creation is bounded. Never hide, freeze or delete what exists when a
  limit drops.
- `ctx.quota.limit(key)` reads the limit (`null` = unlimited) if you want to
  show "3 of 5".

A quota may measure bytes instead of things: `{ key: 'storage', label: 'of
storage', unit: 'bytes' }`. The plan's limit is then in bytes and the refusal
reads as a size. For what is created outside any command (bytes an agent
uploads), a service asks the same way with `deps.quotaFor(workspaceId)`.

In tests: `createTestContext({ quotaLimits: { monitors: 5 }, ownerWorkspaceIds: [1, 2] })`,
and `createTestServiceDeps({ quotaLimits: { storage: 1024 } })` for `quotaFor`.

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
caller's personal workspace, whatever workspace is displayed.

- `'accounts.read'` gives `ctx.deveye.accounts.me()` in a handler and
  `deps.accounts.find / list` in a service.
- `ctx.live.accountChanged(userId)` (or `deps.live.accountChanged`) makes that
  account's open clients re-fetch your resources, wherever they sit.
- `openAccountView()` and `useAccountPlan()` are exported by the client SDK.

## Webhooks

A public route may ask for the undecoded body, which a signature is computed
over:

```ts
app.post('/api/x-demo/webhook', { rawBody: true }, async (req, reply) => {
    verify(req.rawBody, req.headers['x-signature']);
});
```
