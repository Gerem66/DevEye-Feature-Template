# Server handlers

One `defineSdkFeature` per command, exported together from `src/server/index.ts`
as `serverEntry.features`.

```ts
defineSdkFeature({
    ...counterReset,                       // { command, input, output } from your contracts
    access: { level: 'write', extras: ['reset'] },
    mutates: true,                         // broadcast your topic on success
    handler: async (ctx, input) => {
        // input is already validated; the caller already has write access
        // AND the reset extra in this workspace.
        ...
        return state;                      // validated against `output` before it leaves
    }
});
```

## The context, member by member

| Member | What |
|---|---|
| `ctx.userId`, `ctx.workspaceId`, `ctx.workspace` | who, where; `workspace.kind` is `'personal'` or `'shared'` |
| `ctx.isOwner`, `ctx.canWrite` | resolved rights on YOUR feature |
| `ctx.canExtra(key)`, `ctx.extraValue(key)` | your declared permissions; fail-closed defaults |
| `ctx.repo` | your own repo, if you declared `createRepo` (features with tables) |
| `ctx.store` | the per-feature, per-workspace KV store |
| `ctx.cipher(mode?)` | a cipher for your own tables; default `'server'` |
| `ctx.deveye` | native features, gated by `nativeCapabilities` |
| `ctx.audit({ action, description })` | fire-and-forget audit line; actor and workspace pre-bound |
| `ctx.logger`, `ctx.requestId` | structured logging |

What is deliberately absent: other features' data (use the facade), the raw
database (use your repo and store), the session, the encryption keys.

## Errors

Throw `FeatureError(code, message)` for a clean, typed reply:
`validation`, `forbidden`, `not_found`, `conflict`, `locked`, `internal`.
Anything else becomes an opaque `internal` error with a server-side log.

## Testing

`createTestContext()` from `deveye-types/sdk/testing` gives you a fully
in-memory context: identity ciphers, a recording facade
(`ctx.recorded.notifications`), a store whose rows you can inspect
(`ctx.store.rows`). Call your handlers directly from `node:test` files; see
`src/server/handlers.test.ts`.
