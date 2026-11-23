// Three short replies to a question: yes, not now, and a clarifying question. A local LLM writes them when it
// answers within the time limit; otherwise the built-in ones are used, so the glasses never wait.
export const MAX = 60
const clip = s => (s.length <= MAX ? s : s.slice(0, MAX - 1).replace(/\s+\S*$/, '') + '…')

export function builtIn(question) {
  const q = question.toLowerCase()
  if (/\b(when|what time)\b/.test(q)) return ['In ten minutes.', 'Later today, I will ping you.', 'Can you type the details in chat?']
  if (/\b(where|which|what)\b/.test(q)) return ['Give me a sec, I will check.', 'Not sure, can you share a link?', 'Can you type that in chat?']
  return ['Yes, I can.', 'Not right now, can it wait?', 'Can you type the details in chat?']
}

export function makeDrafts(llmUrl, { role = '', timeoutMs = 2500 } = {}) {
  return async function draft(question, context = []) {
    if (!llmUrl) return { replies: builtIn(question), by: 'built-in' }
    try {
      const r = await fetch(`${llmUrl}/v1/chat/completions`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          temperature: 0.4, max_tokens: 120,
          messages: [
            { role: 'system', content: `You suggest replies for someone in a voice call who cannot speak right now and will tap one reply on smart glasses. ${role} Write three replies in first person, each under ${MAX} characters: accept says yes or gives a neutral answer; decline says no or not now, politely; ask is one short clarifying question about the request, ending with "?". Use only facts stated in the question; if it asks for a fact you do not know (a branch, a number, a time), reply 1 says you will check. Answer as JSON.` },
            { role: 'user', content: 'Question to me: Sudeep, which branch did you merge the fix into?' },
            { role: 'assistant', content: '{"accept":"Let me check and post it here.","decline":"Not sure right now, can I get back to you?","ask":"Which fix do you mean?"}' },
            { role: 'user', content: 'Question to me: Sudeep, are you joining the design review at four?' },
            { role: 'assistant', content: '{"accept":"Yes, I will join at four.","decline":"I cannot make four, can we move it?","ask":"Is there anything I should prepare?"}' },
            { role: 'user', content: `Recent lines:\n${context.join('\n')}\n\nQuestion to me: ${question}` },
          ],
          response_format: { type: 'json_schema', json_schema: { name: 'replies', schema: { type: 'object', properties: { accept: { type: 'string' }, decline: { type: 'string' }, ask: { type: 'string' } }, required: ['accept', 'decline', 'ask'] } } },
        }),
      })
      const j = JSON.parse((await r.json()).choices[0].message.content)
      const replies = [j.accept, j.decline, j.ask].map(s => clip(String(s ?? '').trim())).filter(Boolean)
      // keep the model honest: the third reply must ask, and no reply may bring in names, numbers or code the question did not have
      const known = new Set(question.toLowerCase().match(/[a-z0-9']+/g) ?? [])
      const invents = r => (r.match(/'[^']+'|\b\d[\d:.]*\b|\b(main|master|dev|prod|staging)\b/gi) ?? []).some(w => !known.has(w.replace(/'/g, '').toLowerCase()))
      if (replies.length === 3) {
        const fallback = builtIn(question)
        const agrees = r => /^(yes|sure|ok|okay|i can|i will|i'll)\b/i.test(r) && !/\b(not|can't|cannot|later|tomorrow)\b/i.test(r)
        return { replies: replies.map((r, i) => (invents(r) || (i === 1 && agrees(r)) || (i === 2 && !r.endsWith('?')) ? fallback[i] : r)), by: 'llm' }
      }
    } catch {}
    return { replies: builtIn(question), by: 'built-in' }
  }
}
