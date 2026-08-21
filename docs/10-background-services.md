# Background services

Export `createService` from your server entry to run periodic work: polling an
external API, firing deadlines, refreshing a cache.

```ts
export function createService(deps: FeatureServiceDeps): FeatureService {
    return deps.createTicker({
        intervalMs: 60_000,
        async tick() {
            for (const workspaceId of await deps.listWorkspaceIds()) {
                const store = deps.storeFor(workspaceId);
                ...
            }
        }
    });
}
```

`createTicker` is the app's standard loop: an interval, a reentrancy guard (a
slow tick is never overlapped by the next), errors logged and swallowed so one
bad tick never kills the service. Use it instead of rolling your own; there is
no cron, no queue, and that is a deliberate choice of the host.

## The deps, and what is missing

`repo`, `listWorkspaceIds()`, `storeFor(workspaceId)`, `cipherFor(workspaceId)`,
`deveyeFor(workspaceId)` (notify only), `createTicker`, `logger`.

No user, no session, no `'private'` tier: the sessionless store cannot write
private values (the type refuses), and reading one throws `locked`. If your
scheduler needs a value, store it with the default `'server'` encryption. This
is the platform's encryption promise, not a missing feature.

## Discipline that keeps hosts happy

- Bound each tick: batch, or bail early when there is nothing to do.
- Mark work as done **before** long side effects when replaying would be worse
  than skipping (a crashed tick must not re-send yesterday's alerts).
- Log with `deps.logger` and let the ticker swallow: a service that throws its
  way out of existence takes your feature's freshness with it.
