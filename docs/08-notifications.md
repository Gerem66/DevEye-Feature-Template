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
    { subject: 'Compteur : 100 atteint', body: 'Le compteur vient de passer 100.', payload: { value } },
    { itemId } // optional, when routes are per item
);

// in the background service
const notify = deps.deveyeFor(workspaceId).notify;
if (await notify.hasRoute()) await notify.send({ subject, body });
```

An alert is `{ subject, body, payload?, embeds? }`. `subject` and `body` are
what every channel receives (mail, Slack, a custom webhook): keep them
complete on their own. `payload` adds structured fields for a custom
endpoint. `embeds` is an optional Discord layout (embed objects as the
Discord webhook API takes them), used only on a Discord channel, where it
replaces the plain text; a channel that knows no embeds loses nothing.

Everything is off by default: no channel or no route means nothing is sent,
and `send` resolves `false`. Never treat that as an error; a workspace that
chose silence chose it. If your feature marks things as "already notified", do
it whether or not the send happened, or a later route configuration would
replay history (see the milestone notification in the Counter example:
sent from the increment handler itself, no background service needed).

## Live messages: one message, edited until it concludes

Some news is a process, not an event: a deployment that starts, runs, then
succeeds or fails. Sending one alert per step floods a channel; sending only
the conclusion hides the ten minutes that mattered. For that shape the facade
offers a **live message**: a rich message posted once and edited in place
until it concludes. Discord webhooks carry it today; a channel that cannot is
simply not listed.

```ts
// when the process starts
const channels = await ctx.deveye.notify.liveChannels({ itemId });
for (const channel of channels) {
    const messageId = await ctx.deveye.notify.postLive(channel.id, { embeds: [startEmbed] });
    // keep messageId (with channel.id) next to the process it follows
}

// on every step
const next = await notify.postLive(channel.id, { embeds: [progressEmbed] }, messageId);
if (next === null) {
    // the channel refused (message deleted by hand, webhook revoked): stop
    // editing, never repost
}

// at the end: the live channels already heard the news, the others get the alert
await notify.send({ subject, body, embeds }, { itemId, except: channels.map((c) => c.id) });
```

`liveChannels` follows the same routing as `send` (the channels routed to
your feature, or to this item when `itemId` is given) and only lists the ones
able to carry a live message; an empty list means "post nothing, send as
usual". `postLive` takes an `SdkRichMessage` (`content?`, `embeds?`, what the
Discord webhook API takes) and resolves the message id to keep for the next
edit, or `null` when the channel refused: treat that as the end of the live
message, not as an error to retry. `send(..., { except })` skips the channels
a live message concluded on, so no channel hears the same news twice.

## Test it end to end

In DevEye: your feature's settings, Notifications tab, add a channel (a
Discord webhook is the fastest), route it, then trigger the event. The tab's
"test" button exercises the channel without your code.
