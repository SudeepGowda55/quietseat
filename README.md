# Quiet Seat

**Live captions of a Discord voice call on Even Realities G2 glasses, and a one-tap reply when someone says your name.**

For people who are in a call but can't play its audio: in a library, on a train, next to a sleeping baby, or hard of hearing. Quiet Seat sits in the Discord voice channel, captions only the people who pressed **Caption me**, and when someone asks you something by name, the glasses show the question and three short replies. Tap one with the R1 ring and it is posted in the call's chat, addressed to the person who asked.

Built for the [Heads Up: Even Realities Hackathon](https://dorahacks.io/hackathon/even-realities/detail), track 01 Messaging & News (Discord), by team Matcrypt.

## Status

In progress during build week (23 to 29 November 2026). Measured so far on an M1 MacBook Air (8 GB):

- Speech to text: whisper.cpp `small.en` on this laptop, a caption about 0.5 s after each sentence ends (Discord audio, end to end), 850 MB of memory.
- The question on the glasses: 1.4 to 2.5 s after the asker stops speaking, including three replies drafted by a 1.5B model on the laptop (about 260 MB).
- The G2 screen in the Even Hub simulator 0.9.5: about 54 characters per line and 9 caption lines; the reply screen fits the question plus three replies of up to 60 characters.
- Discord: the bot receives end-to-end encrypted (DAVE) voice, posts the consent card, and posts the tapped reply in the call's chat, tested end to end with a second bot speaking recorded audio.

## What existed before 23 November

- `glasses/` started from the official [Even Hub minimal template](https://github.com/even-realities/evenhub-templates) (MIT).
- Open-source libraries: discord.js, @discordjs/voice (with a one-line patch for discord.js issue #11653 in `bot/patches`), whisper.cpp.

Everything else is written during the hackathon.

## Privacy

Opt-in only: nobody is transcribed until they press **Caption me**, and anyone can opt out at any time. Speech is transcribed on the wearer's laptop; no audio or transcript is saved.

## Licence

MIT
