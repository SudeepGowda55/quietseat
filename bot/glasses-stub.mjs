// Stands in for the glasses app: prints each screen, and taps reply 1 when a question arrives.
import WebSocket from 'ws'
const ws = new WebSocket('ws://127.0.0.1:8787/?token=dev')
ws.on('message', m => {
  const s = JSON.parse(m)
  console.log('SCREEN', JSON.stringify(s))
  if (s.screen === 'called') setTimeout(() => ws.send(JSON.stringify({ type: 'reply', index: 0 })), 1500)
})
setTimeout(() => process.exit(0), Number(process.argv[2] || 60) * 1000)
