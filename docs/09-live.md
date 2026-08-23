# Live presence

In a shared workspace, members see each other: who is in which view, cursors,
outlines on what someone else is looking at, and one-click teleport to a
peer's location. Most of it costs you nothing.

## What is free

- **Presence and cursors**: as soon as your feature is in the catalog, the
  presence widget shows "Alice · Counter" and cursors render over your view.
- **Refresh on writes**: your `mutates` commands broadcast your topic; peers'
  clients re-fetch your resources. Covered in [05-client](05-client.md).
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
- **The rendezvous is byte-for-byte.** The string your view declares for an
  item MUST equal what your manifest's `itemSegment(id)` builds: that function
  is how "open the settings of item 42 from another workspace" and "join
  Alice" find your view.

## Typing indicator

For chat-like surfaces: `useTypingSignal().onInput()` while the user types,
`useTypers()` to render who else is. Location is never transmitted; declaring
your segment is what scopes it.
