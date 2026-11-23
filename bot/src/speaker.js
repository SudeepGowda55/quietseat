// Test helper: a second bot plays recorded speech into the voice channel, so receiving can be tested without a person.
import { Client, GatewayIntentBits, ChannelType } from 'discord.js'
import { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, VoiceConnectionStatus, AudioPlayerStatus } from '@discordjs/voice'

const files = process.argv.slice(2)
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] })
await client.login(process.env.SPEAKER_TOKEN)
await new Promise(r => client.once('clientReady', r))
const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID)
const channel = (await guild.channels.fetch()).find(c => c.type === ChannelType.GuildVoice)
const connection = joinVoiceChannel({ channelId: channel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true, selfMute: false, group: 'speaker' })
await entersState(connection, VoiceConnectionStatus.Ready, 30_000)
const player = createAudioPlayer()
connection.subscribe(player)
for (const f of files) {
  console.log('playing', f)
  player.play(createAudioResource(f))
  await entersState(player, AudioPlayerStatus.Playing, 10_000)
  await entersState(player, AudioPlayerStatus.Idle, 120_000)
  await new Promise(r => setTimeout(r, 1500))
}
connection.destroy(); client.destroy()
