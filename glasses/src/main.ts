// Spike: measure what fits on the G2 display before designing the real screens.
import {
  waitForEvenAppBridge, TextContainerProperty, ListContainerProperty, ListItemContainerProperty,
  CreateStartUpPageContainer, RebuildPageContainer, OsEventTypeList,
} from '@evenrealities/even_hub_sdk'

const bridge = await waitForEvenAppBridge()
const header = (content: string) => new TextContainerProperty({ xPosition: 0, yPosition: 0, width: 576, height: 36, borderWidth: 0, borderColor: 5, paddingLength: 4, containerID: 1, containerName: 'head', content, isEventCapture: 0 })
const captions = new TextContainerProperty({ xPosition: 0, yPosition: 40, width: 576, height: 248, borderWidth: 0, borderColor: 5, paddingLength: 4, containerID: 2, containerName: 'body', isEventCapture: 1,
  content: [1, 2, 3, 4, 5, 6, 7, 8].map(i => `${i} Asha: we ship the build tonight, can someone check the deploy logs 0123456789`).join('\n') })
await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({ containerTotalNum: 2, textObject: [header('#standup . 3 in call . 2 captioned  ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'), captions] }))

let called = false
bridge.onEvenHubEvent(async event => {
  const t = event.sysEvent ? (event.sysEvent.eventType ?? OsEventTypeList.CLICK_EVENT) : event.textEvent ? (event.textEvent.eventType ?? OsEventTypeList.CLICK_EVENT) : null
  if (t === OsEventTypeList.DOUBLE_CLICK_EVENT) return bridge.shutDownPageContainer(1)
  if (t !== OsEventTypeList.CLICK_EVENT || called) return
  called = true
  await bridge.rebuildPageContainer(new RebuildPageContainer({
    containerTotalNum: 2,
    textObject: [new TextContainerProperty({ xPosition: 0, yPosition: 0, width: 576, height: 110, borderWidth: 0, borderColor: 5, paddingLength: 4, containerID: 1, containerName: 'ask', isEventCapture: 0,
      content: 'ASHA ASKED YOU:\nSudeep, can you take the deploy tonight? I need someone on call after nine, 0123456789 abcdefghij' })],
    listObject: [new ListContainerProperty({ xPosition: 0, yPosition: 112, width: 576, height: 176, borderWidth: 0, borderColor: 5, paddingLength: 2, containerID: 2, containerName: 'replies', isEventCapture: 1,
      itemContainer: new ListItemContainerProperty({ itemCount: 4, itemWidth: 572, isItemSelectBorderEn: 1,
        itemName: ['Yes, I will take tonight\'s deploy after nine. 0123456789abcdef', 'Not tonight, can we do tomorrow morning?', 'Which service is it, the API or the web app?', 'Dismiss'] }) })],
  }))
})
