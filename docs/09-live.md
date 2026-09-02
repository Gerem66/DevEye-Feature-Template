# Live presence

In a shared workspace, members see each other: who is in which view, cursors,
outlines on what someone else is looking at, and one-click teleport to a
peer's location. Most of it costs you nothing.

## What is free

- **Presence and cursors**: as soon as your feature is in the catalog, the
  presence widget shows "Alice · Counter" and cursors render over your view.
- **Refresh on writes**: your `mutates` commands broadcast your topic; peers'
  clients re-fetch your resources. Covered in [05-client](05-client.md). A
  write that must not refresh everything beats one of your secondary topics
  instead (`manifest.topics`, `mutates: ['<topic>']`); see
  [02-manifest](02-manifest.md#secondary-topics-of-your-own).
- **Card outlines**: the home card of a feature a peer is inside gets their
  colored outline automatically.

## Declaring where you are (features with items)

Positions are paths of segments: `view:x-myfeature` then `l1`, `l2`, ... Your
view declares its depth so peers see "inside item 42", outlines land on the
right row, and teleport can reach it:

```tsx
// The open item declares l1; rows get outlines; teleport is consumed when ready.
useLiveItemTarget('l1', openedId === null ? null : `job:${openedId}`, listLoaded, (value) => {
    if (value === null) setOpenedId(null);
    else setOpenedId(parseId(value));       // ignore ids not in the list: the
                                            // target stays standing until ready
});

const outline = useLiveOutlines('l1');
... <div {...outline(`job:${row.id}`)}>    // peer-colored outline on that row
```

Two contracts to respect:

- **One declarer per level.** `useLiveSegment`/`useLiveItemTarget` declare the
  view's current position; call them once per kind, never per row. Rows use
  `useLiveOutlines`.
- **An item's segment is its bare id.** Declare `useLiveSegment('l1',
String(id))` for the open item, nothing else: `view:<your id>` already says
  what kind of item it is, and that bare id is how "open the settings of item
  42 from another workspace" and "join Alice" find your view.

## Writes without a command

Your `mutates: true` commands broadcast your topic on their own. A background
service writes without a command, so it says so itself:
`deps.live.changed(workspaceId)` makes every member's client re-fetch your
declared resources (and the workspaces linked by projections, for a
share-wired feature). Call it on state transitions, never on every tick: each
call re-fetches for everyone. `deps.live.changed(workspaceId, ['<topic>'])`
beats the topics named instead of your id: one of your secondary topics
(`manifest.topics`), or another feature's topic whose screens mirror what you
just wrote.

## Pushing your own frames (`live.publish`)

Invalidation says "something changed, ask again". Some state has to be seen AS
it changes: a cell someone just drew on a shared board, a token moved on a map.
Declare `'live.publish'` in `nativeCapabilities` and push the CHANGE itself:

```ts
// in a handler: the workspace is the caller's, already authorized
ctx.live.publish('x-myfeature.moved', { id, x, y });

// in a service, which has no caller: name the workspace
deps.live.publish(workspaceId, 'x-myfeature.moved', { id, x, y });
```

```tsx
// client side, while your view is mounted
useEffect(() => onServerEvent('x-myfeature.moved', movedSchema, apply), [apply]);
```

The frame reaches every member of that workspace connected right now and
holding `read` on your feature, and nobody else. `event` must start with your
feature id, like a command; it never carries a `requestId`, so it can never be
mistaken for a reply.

Three rules that come with the lane:

- **Push the change, never the state.** A full snapshot on every frame is what
  invalidation already does, more cheaply.
- **A frame can be missed** (a socket in backpressure drops it, a tab was
  asleep). Your client must be able to recover on its own — re-read your state
  on `onSocketOpen`, and on a frame that no longer makes sense — rather than
  assume every frame lands.
- **The rate is yours to hold.** Unlike `changed`, nothing throttles this lane:
  what bounds it is the cadence of the command that emits it.

## Typing indicator

For chat-like surfaces: `useTypingSignal().onInput()` while the user types,
`useTypers()` to render who else is. Location is never transmitted; declaring
your segment is what scopes it.
