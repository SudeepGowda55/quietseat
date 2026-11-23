// Spike: can this bot receive (DAVE end-to-end encrypted) voice? Joins the voice channel, saves each utterance as 16 kHz mono WAV.
import { writeFileSync } from 'node:fs'
import { Client, GatewayIntentBits, ChannelType } from 'discord.js'
import { joinVoiceChannel, EndBehaviorType, VoiceConnectionStatus, entersState } from '@discordjs/voice'
import prism from 'prism-media'

const OUT = process.argv[2]
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] })
await client.login(process.env.DISCORD_TOKEN)
await new Promise(r => client.once('clientReady', r))
const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID)
const channel = (await guild.channels.fetch()).find(c => c.type === ChannelType.GuildVoice)
console.log('joining', channel.name)
const connection = joinVoiceChannel({ channelId: channel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: false, selfMute: true, daveEncryption: true, debug: true })
connection.on('stateChange', (a, b) => console.log('voice', a.status, '->', b.status))
connection.on('debug', m => /dave|transition|epoch|mls/i.test(m) && console.log('debug', m.slice(0, 160)))
await entersState(connection, VoiceConnectionStatus.Ready, 30_000)
console.log('READY. Waiting for someone to speak...')

let n = 0
connection.receiver.speaking.on('start', userId => {
  if (connection.receiver.subscriptions.has(userId)) return
  const opus = connection.receiver.subscribe(userId, { end: { behavior: EndBehaviorType.AfterSilence, duration: 700 } })
  const pcm = opus.pipe(new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 }))
  const chunks = []
  pcm.on('data', c => chunks.push(c))
  opus.on('error', e => console.log('receive error', e.message))
  pcm.on('end', () => {
    const s = Buffer.concat(chunks), frames = s.length / 4, out = Buffer.alloc(Math.floor(frames / 3) * 2)
    for (let i = 0, j = 0; j < out.length; i += 3, j += 2) out.writeInt16LE((s.readInt16LE(i * 4) + s.readInt16LE(i * 4 + 2)) >> 1, j) // mono, 48k -> 16k
    const h = Buffer.alloc(44); h.write('RIFF', 0); h.writeUInt32LE(36 + out.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
    h.writeUInt32LE(16000, 24); h.writeUInt32LE(32000, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(out.length, 40)
    const file = `${OUT}/utt-${++n}-${userId}.wav`; writeFileSync(file, Buffer.concat([h, out]))
    console.log('saved', file, (out.length / 32000).toFixed(1) + 's')
  })
})
setTimeout(() => { connection.destroy(); client.destroy(); process.exit(0) }, Number(process.argv[3] || 180) * 1000)
