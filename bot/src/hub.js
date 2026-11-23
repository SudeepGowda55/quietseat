// The glasses app connects here over WebSocket. Every new client gets the current screen at once, so a dropped
// connection or a reloaded WebView picks up where it was.
import { WebSocketServer } from 'ws'

export function startHub({ port, token, onCommand }) {
  const wss = new WebSocketServer({ port })
  let state = { screen: 'status', text: 'Waiting for the call' }
  const send = (ws, m) => ws.readyState === 1 && ws.send(JSON.stringify(m))
  wss.on('connection', (ws, req) => {
    if (token && new URL(req.url, 'http://x').searchParams.get('token') !== token) return ws.close(4001, 'bad token')
    send(ws, state)
    ws.on('message', raw => { try { onCommand(JSON.parse(raw)) } catch {} })
  })
  return {
    show(next) { state = next; wss.clients.forEach(ws => send(ws, state)) },
    get state() { return state },
    close: () => new Promise(r => { wss.clients.forEach(ws => ws.terminate()); wss.close(r) }),
  }
}
