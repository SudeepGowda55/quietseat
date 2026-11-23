// Quiet Seat on the G2: live captions of the Discord call, and the question plus three replies when someone asks
// the wearer by name. The bot on the wearer's laptop does the listening; this app only shows screens and sends taps.
import {
  waitForEvenAppBridge, TextContainerProperty, TextContainerUpgrade, ListContainerProperty, ListItemContainerProperty,
  CreateStartUpPageContainer, RebuildPageContainer, OsEventTypeList,
} from '@evenrealities/even_hub_sdk'

type Screen =
  | { screen: 'status'; text: string }
  | { screen: 'captions'; header: string; lines: string[] }
  | { screen: 'called'; asker: string; question: string; replies: string[] }
  | { screen: 'sent'; text: string }

const W = 576, H = 288, CHARS = 54, BODY_LINES = 9 // measured in the simulator: about 56 characters per line, 9 lines in 248 px

const params = new URLSearchParams(location.search)
const WS = params.get('ws') ?? `ws://${location.hostname}:8787`
const TOKEN = params.get('token') ?? ''

const bridge = await waitForEvenAppBridge()

const text = (id: number, name: string, y: number, h: number, content: string, capture = 0) =>
  new TextContainerProperty({ xPosition: 0, yPosition: y, width: W, height: h, borderWidth: 0, borderColor: 5, paddingLength: 4, containerID: id, containerName: name, content, isEventCapture: capture })

// Glasses show ASCII only; anything else would be dropped, so swap the usual suspects first.
const ascii = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/[^\x20-\x7e\n]/g, '')

// Keep the newest lines that fit: a caption longer than one row wraps, so count rows, not lines.
function fit(lines: string[]) {
  const out: string[] = []
  let rows = 0
  for (const line of [...lines].reverse()) {
    const r = Math.max(1, Math.ceil(line.length / CHARS))
    if (rows + r > BODY_LINES) break
    out.unshift(line); rows += r
  }
  return out.join('\n')
}

let layout: Screen['screen'] | 'start' = 'start'
let pending: Screen | null = null, timer = 0

async function render(s: Screen) {
  if (s.screen === 'captions') {
    const body = ascii(fit(s.lines)) || 'Nobody has spoken yet.'
    if (layout === 'captions') { // same layout: update the text in place, no flicker
      await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 1, containerName: 'head', content: ascii(s.header) }))
      await bridge.textContainerUpgrade(new TextContainerUpgrade({ containerID: 2, containerName: 'body', content: body }))
      return
    }
    await page({ containerTotalNum: 2, textObject: [text(1, 'head', 0, 36, ascii(s.header)), text(2, 'body', 40, H - 40, body, 1)] })
  } else if (s.screen === 'called') {
    await page({
      containerTotalNum: 2,
      textObject: [text(1, 'ask', 0, 110, ascii(`${s.asker.toUpperCase()} ASKED YOU:\n${s.question}`))],
      listObject: [new ListContainerProperty({ xPosition: 0, yPosition: 112, width: W, height: H - 112, borderWidth: 0, borderColor: 5, paddingLength: 2, containerID: 2, containerName: 'replies', isEventCapture: 1,
        itemContainer: new ListItemContainerProperty({ itemCount: s.replies.length + 1, itemWidth: W - 4, isItemSelectBorderEn: 1, itemName: [...s.replies, 'Dismiss'].map(ascii) }) })],
    })
  } else {
    await page({ containerTotalNum: 1, textObject: [text(1, 'msg', 0, H, ascii(s.text), 1)] })
  }
  layout = s.screen
}

async function page(p: { containerTotalNum: number; textObject?: TextContainerProperty[]; listObject?: ListContainerProperty[] }) {
  if (layout === 'start') await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(p))
  else await bridge.rebuildPageContainer(new RebuildPageContainer(p))
}

// Captions can arrive several times a second; draw at most every 120 ms.
function show(s: Screen) {
  pending = s
  if (timer) return
  timer = window.setTimeout(async () => { timer = 0; const next = pending!; pending = null; await render(next).catch(e => console.error('render failed', e)) }, 120)
}

let ws: WebSocket | null = null, retry = 500
function connect() {
  ws = new WebSocket(`${WS}/?token=${encodeURIComponent(TOKEN)}`)
  ws.onopen = () => { retry = 500 }
  ws.onmessage = m => show(JSON.parse(m.data))
  ws.onclose = () => { show({ screen: 'status', text: `Quiet Seat\n\nLooking for the bot on your laptop...\n${WS}` }); setTimeout(connect, retry); retry = Math.min(retry * 2, 8000) }
}
const send = (c: object) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(c))

show({ screen: 'status', text: 'Quiet Seat\n\nConnecting...' })
connect()

// A tap on an envelope without an eventType is a click (protobuf drops zero values); see the minimal template.
const typeOf = (e?: { eventType?: OsEventTypeList }) => (e ? e.eventType ?? OsEventTypeList.CLICK_EVENT : null)

bridge.onEvenHubEvent(event => {
  const types = [typeOf(event.sysEvent), typeOf(event.textEvent), typeOf(event.listEvent)]
  if (types.includes(OsEventTypeList.DOUBLE_CLICK_EVENT)) return void bridge.shutDownPageContainer(1)
  if (!types.includes(OsEventTypeList.CLICK_EVENT)) return
  if (layout === 'called' && event.listEvent) {
    const i = event.listEvent.currentSelectItemIndex ?? 0
    send(i < 3 ? { type: 'reply', index: i } : { type: 'dismiss' })
  } else if (layout === 'captions') {
    send({ type: 'reply-last' }) // the detector missed it: reply to the last captioned line
  }
})
