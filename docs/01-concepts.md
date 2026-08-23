# Concepts: the one-page map

DevEye is a workspace dashboard. Everything your feature does happens **inside
one workspace at a time**, under rights resolved **before** your code runs.

```
user ── member of ──> workspace (personal | shared)
                          │
                          ├── roles ──> grants: { feature, access: read|write,
                          │                       channels, extras {...} }
                          ├── home layout: cards on a grid (your Widget)
                          └── data: rows/KV always filtered by workspace_id
```

## The request path

1. The client sends a WebSocket command, e.g. `x-counter.increment`. The active
   workspace travels on the envelope; you never pass or check it.
2. The dispatcher validates the input against your zod schema, resolves the
   caller's rights in that workspace, enforces your declared `access`, then
   calls your handler with a ready context (`ctx`).
3. Your handler returns; the output is validated against your schema too.
4. If the command declared `mutates: true`, the server broadcasts your
   feature's **topic** (= your id) to every member with read access. Their
   clients re-fetch the **resource keys** your manifest declares. Nothing
   polls, ever.

## The vocabulary

- **Feature id**: `x-<slug>`. Also your command prefix, your live topic, and
  the base of your resource keys and table names.
- **Access**: absent = the feature does not exist for that member; `read`;
  `write` (implies read). Plus `channels` (manage alert channels) and your own
  `extraPermissions`, all granted per role.
- **Resource key**: `x-<slug>.<name>`, what the client caches under
  `useResource`. By convention, the command whose result it caches.
- **Tiers of encryption**: `'server'` (encrypted at rest, server-readable,
  works everywhere), `'private'` (readable only in an unlocked user session),
  `'none'` (plain). One argument at the storage call site.
- **Personal vs shared**: `ctx.workspace.kind`. Live presence, roles and
  member lists only exist in shared workspaces.

## Where your code runs

- **Handlers**: per request, with a user, a workspace, rights, and both
  encryption tiers.
- **Background service**: per process, with no user and no session. The types
  make the difference impossible to miss: the sessionless store cannot write
  `'private'`, and reading a private value throws.

That is the whole model. Every other doc is one of these boxes, zoomed in.
