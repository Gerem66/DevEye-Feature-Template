# Notifications

DevEye's notification system is workspace infrastructure: members declare
**channels** (email, webhook, Discord) per feature and route them per target.
Your feature never stores an address, never sends an email, never knows a
webhook URL. It says "something happened"; the workspace decides who hears it.

## Declare

```ts
// manifest
notifies: true,                     // opens the Notifications tab + the channels grant
nativeCapabilities: ['notify']      // lets your server code call ctx.deveye.notify
```

The whole settings surface (declaring channels, testing them, routing) is the
generic tab: you write no UI.

## Send

```ts
// in a handler
await ctx.deveye.notify.send(
    { subject: 'Deadline: demo', body: '"Demo day" is due.', payload: { id } },
    { itemId }                      // optional, when routes are per item
);

// in the background service
const notify = deps.deveyeFor(workspaceId).notify;
if (await notify.hasRoute()) await notify.send({ subject, body });
```

Everything is off by default: no channel or no route means nothing is sent,
and `send` resolves `false`. Never treat that as an error; a workspace that
chose silence chose it. If your feature marks things as "already notified", do
it whether or not the send happened, or a later route configuration would
replay history (see the Countdown service).

## Test it end to end

In DevEye: your feature's settings, Notifications tab, add a channel (a
Discord webhook is the fastest), route it, then trigger the event. The tab's
"test" button exercises the channel without your code.
