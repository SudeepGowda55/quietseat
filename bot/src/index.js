// Quiet Seat: follows the wearer into Discord voice, captions only people who opted in, and when the wearer is
// asked something by name, puts the question and three replies on the glasses. A tapped reply goes to the call's chat.
import { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js'
import { joinVoiceChannel, getVoiceConnection, EndBehaviorType, entersState, VoiceConnectionStatus } from '@discordjs/voice'
import prism from 'prism-media'
import { randomBytes } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import { writeFileSync } from 'node:fs'
import { toWav16k, seconds } from './audio.js'
import { calledBy } from './names.js'
import { makeStt } from './stt.js'
import { makeDrafts } from './drafts.js'
import { startHub } from './hub.js'

const env = process.env
const ALIASES = (env.QS_ALIASES || 'Sudeep,Sudhi,Sudip').split(',').map(s => s.trim()).filter(Boolean)
const ALSO = new Set((env.QS_CAPTION_ALSO || '').split(',').filter(Boolean)) // test-only: bots that cannot press a button
const TOKEN = env.QS_PAIR_TOKEN || randomBytes(9).toString('base64url') // without a token, anyone on the network could reply as the wearer
// Recording is off unless asked for, announced on the consent card, and only ever holds what people opted into.
const RECORD = env.QS_RECORD || ''
if (RECORD && ALSO.size) { console.error('QS_RECORD cannot be used with QS_CAPTION_ALSO: everyone recorded must have pressed Caption me.'); process.exit(2) }
const session = { started: new Date().toISOString(), events: [] }
const record = e => { if (!RECORD) return; session.events.push({ t: Date.now() - Date.parse(session.started), ...e }); writeFileSync(RECORD, JSON.stringify(session, null, 1)) }
const transcribe = makeStt(env.QS_WHISPER || 'http://127.0.0.1:8178', ALIASES)
const draft = makeDrafts(env.QS_LLM || '', { role: env.QS_ROLE || '' })
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a) // never logs what anyone said

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] })
const call = { channel: null, consent: new Set(), lines: [], called: null, cooldownUntil: 0, card: null, queue: Promise.resolve() }
const hub = startHub({ port: Number(env.QS_PORT || 8787), token: TOKEN, onCommand: c => onGlasses(c).catch(e => log('glasses command failed', e.message)) })

let wearerId
const name = id => call.channel?.guild.members.cache.get(id)?.displayName ?? 'Someone'
const others = () => [...(call.channel?.members.values() ?? [])].filter(m => m.id !== wearerId && m.id !== client.user.id)

function showCaptions() {
  if (!call.channel) return hub.show({ screen: 'status', text: 'Waiting for the call' })
  if (call.called) return hub.show({ screen: 'called', ...call.called })
  const people = others(), captioned = people.filter(m => call.consent.has(m.id)).length
  hub.show({ screen: 'captions', header: `#${call.channel.name} . ${people.length + 1} in call . ${captioned} captioned`,
    lines: call.lines.slice(-9).map(l => l.text === null ? `${l.speaker} speaking (not captioned)` : `${l.speaker}: ${l.text}`) })
}

function addLine(line) {
  const last = call.lines.at(-1)
  if (line.text === null && last?.text === null && last.id === line.id) return // one "speaking" line per turn
  call.lines.push(line); if (call.lines.length > 30) call.lines.shift()
  showCaptions()
}

async function heard(id, wav) {
  if (seconds(wav) < 0.4) return
  const t0 = Date.now(), text = await transcribe(wav)
  if (!text) return
  log(`caption ${seconds(wav).toFixed(1)} s of audio in ${Date.now() - t0} ms`)
  addLine({ id, speaker: name(id), text, t: Date.now() })
  if (call.consent.has(id)) record({ type: 'caption', speaker: name(id), text })
  if (call.called || Date.now() < call.cooldownUntil || !calledBy(text, ALIASES)) return
  const context = call.lines.slice(-3, -1).map(l => `${l.speaker}: ${l.text ?? '(not captioned)'}`)
  const { replies, by } = await draft(text, context)
  log(`called by name, replies by ${by}, ${Date.now() - t0} ms after speech ended`)
  call.called = { asker: name(id), askerId: id, question: text, replies }
  record({ type: 'called', asker: name(id), question: text, replies, by })
  showCaptions()
}

function listen(connection) {
  connection.receiver.speaking.on('start', id => {
    if (id === wearerId || id === client.user.id || connection.receiver.subscriptions.has(id)) return
    if (!call.consent.has(id) && !ALSO.has(id)) { record({ type: 'speaking' }); return addLine({ id, speaker: name(id), text: null, t: Date.now() }) } // recorded without a name
    const opus = connection.receiver.subscribe(id, { end: { behavior: EndBehaviorType.AfterSilence, duration: 700 } })
    const pcm = opus.pipe(new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }))
    const chunks = []
    pcm.on('data', c => chunks.push(c))
    opus.on('error', e => log('receive error', e.message))
    pcm.on('end', () => { const wav = toWav16k(Buffer.concat(chunks)); chunks.length = 0; call.queue = call.queue.then(() => heard(id, wav)).catch(e => log('caption failed', e.message)) })
  })
}

async function join(channel) {
  call.channel = channel; call.consent.clear(); call.lines = []; call.called = null
  const connection = joinVoiceChannel({ channelId: channel.id, guildId: channel.guild.id, adapterCreator: channel.guild.voiceAdapterCreator, selfDeaf: false, selfMute: true })
  await entersState(connection, VoiceConnectionStatus.Ready, 30_000)
  listen(connection)
  log('joined', channel.name)
  call.card = await channel.send({
    content: `**Quiet Seat** shows live captions of this call on **${name(wearerId)}**'s glasses, because they can't play the audio right now. ` +
      'Speech is turned into text on their laptop; no audio or transcript is saved, and nothing leaves that laptop. ' +
      'Only people who press **Caption me** are captioned. You can stop any time.' +
      (RECORD ? '\n**This call is being recorded for Quiet Seat\'s public demo video and website:** only the captions of people who press Caption me, the question, the replies and the tap. People who do not opt in appear only as "Someone speaking".' : ''),
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('qs:on').setLabel('Caption me').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('qs:off').setLabel('No thanks / stop').setStyle(ButtonStyle.Secondary))],
  }).catch(e => { log('could not post the consent card', e.message); return null })
  showCaptions()
}

function leave() {
  getVoiceConnection(call.channel?.guild.id ?? '')?.destroy()
  call.card?.delete().catch(() => {})
  call.channel = null; call.consent.clear(); call.lines = []; call.called = null; call.card = null
  log('left the call; consent and captions cleared')
  showCaptions()
}

async function onGlasses(c) {
  if (c.type === 'reply-last' && !call.called) { // manual: treat the last captioned line as the question
    const last = [...call.lines].reverse().find(l => l.text)
    if (!last) return
    const { replies } = await draft(last.text, [])
    call.called = { asker: last.speaker, askerId: last.id, question: last.text, replies }
    return showCaptions()
  }
  if (!call.called) return
  const { askerId, replies } = call.called
  call.called = null; call.cooldownUntil = Date.now() + 20_000
  if (c.type === 'reply' && replies[c.index]) {
    await call.channel.send({ content: `**${name(wearerId)}** (via Quiet Seat, to <@${askerId}>): ${replies[c.index]}`, allowedMentions: { users: [askerId] } })
    log('reply posted')
    record({ type: 'tap', index: c.index, reply: replies[c.index] })
    hub.show({ screen: 'sent', text: `Sent to #${call.channel.name}` })
    return setTimeout(showCaptions, 2000)
  }
  showCaptions()
}

client.on(Events.InteractionCreate, async i => {
  if (!i.isButton() || !i.customId.startsWith('qs:')) return
  if (i.customId === 'qs:on') call.consent.add(i.user.id); else call.consent.delete(i.user.id)
  log(`consent ${i.customId === 'qs:on' ? 'given' : 'withdrawn'} (${call.consent.size} captioned)`)
  record({ type: 'consent', captioned: call.consent.size })
  await i.reply({ content: i.customId === 'qs:on' ? 'You are being captioned for this call. Press "No thanks / stop" any time.' : 'You are not captioned.', flags: MessageFlags.Ephemeral })
  showCaptions()
})

client.on(Events.VoiceStateUpdate, async (before, after) => {
  if (after.id === wearerId) {
    if (after.channel && after.channel.id !== call.channel?.id) { if (call.channel) leave(); await join(after.channel) }
    else if (!after.channel && call.channel) leave()
  } else if (call.channel && before.channelId === call.channel.id && after.channelId !== call.channel.id) {
    call.consent.delete(after.id) // consent ends when you leave the call
  }
  if (call.channel) showCaptions()
})

client.once(Events.ClientReady, async () => {
  const guild = await client.guilds.fetch(env.DISCORD_GUILD_ID)
  wearerId = env.QS_WEARER_ID || guild.ownerId
  await guild.members.fetch(wearerId).catch(() => {})
  const lan = Object.values(networkInterfaces()).flat().find(a => a?.family === 'IPv4' && !a.internal)?.address ?? '127.0.0.1'
  log(`ready; wearer ${name(wearerId) === 'Someone' ? wearerId : 'found'}${RECORD ? '; RECORDING this call to ' + RECORD : ''}`)
  log(`open the glasses app at http://${lan}:5173/?ws=ws://${lan}:${env.QS_PORT || 8787}&token=${TOKEN}`)
  const now = guild.voiceStates.cache.get(wearerId)?.channel
  if (now) await join(now)
  else if (env.QS_JOIN) await join((await guild.channels.fetch()).find(c => c.isVoiceBased() && (c.name === env.QS_JOIN || env.QS_JOIN === '1'))) // test runs without the wearer
})

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { leave(); setTimeout(() => hub.close().then(() => process.exit(0)), 800) })
await client.login(env.DISCORD_TOKEN)
