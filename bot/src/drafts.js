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
            { role: 'system', content: `You suggest replies for someone in a voice call who cannot speak right now and will tap one reply on smart glasses. ${role} Write three replies in first person, each under ${MAX} characters: first agrees, second declines or defers politely, third asks one short clarifying question. Never invent facts beyond the question.` },
            { role: 'user', content: `Recent lines:\n${context.join('\n')}\n\nQuestion to me: ${question}` },
          ],
          response_format: { type: 'json_schema', json_schema: { name: 'replies', schema: { type: 'object', properties: { replies: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 } }, required: ['replies'] } } },
        }),
      })
      const replies = JSON.parse((await r.json()).choices[0].message.content).replies.map(s => clip(String(s).trim())).filter(Boolean)
      if (replies.length === 3) return { replies, by: 'llm' }
    } catch {}
    return { replies: builtIn(question), by: 'built-in' }
  }
}
