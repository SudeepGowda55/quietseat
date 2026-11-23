// Was the wearer just asked something by name? Whisper misspells names, so match loosely but only on questions.
const norm = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

// One alias matches one word: exactly, or within one edit for names of 5+ letters. "sudeepa" is a different name.
export function mentions(text, aliases) {
  const words = norm(text).split(' ')
  return aliases.map(norm).some(a => words.some(w => w === a || (a.length >= 5 && w.length >= 5 && Math.abs(w.length - a.length) <= 1 && lev(w, a) <= 1 && !(w.length > a.length && w.startsWith(a)))))
}

const WH = /^(who|what|when|where|why|how|which|whose|can|could|will|would|should|shall|do|does|did|is|are|was|were|have|has|had|any|anyone)\b/
// A question: ends in "?", or a clause starts with a question word.
export function isQuestion(text) {
  if (/\?\s*$/.test(text.trim())) return true
  // "Sudeep can you take it", "okay, are you free": a helper verb followed by its subject, anywhere
  if (/\b(can|could|will|would|should|do|does|did|is|are|was|were|have|has)\s+(you|we|i|he|she|they|it|someone|anyone|anybody)\b/.test(norm(text))) return true
  return norm(text).split(/ (?:and|so|but|okay|ok) | ?, ?/).some(c => WH.test(c.replace(/^(hey|hi|so|okay|ok|and|um|uh) /, '')))
}

// Addressed, not talked about: "Sudeep, can you..." or "hey Sudhi are you..." or any question with "you" in it.
// "Did Sudeep push the fix?" is about the wearer, not to them, so it stays a caption.
export function addressed(text, aliases) {
  if (/\byou(r|rs|rself)?\b/i.test(text)) return true
  // the name on its own between punctuation, the way people call someone: "Sudeep, ...", "... thoughts, Sudhi?"
  return text.split(/[,.?!:;]/).some(c => { const w = norm(c).replace(/^(hey|hi|so|okay|ok|and|um|uh|oh) /, '').split(' ').filter(Boolean); return w.length === 1 && mentions(w[0], aliases) })
}

export function calledBy(text, aliases) { return mentions(text, aliases) && isQuestion(text) && addressed(text, aliases) }
