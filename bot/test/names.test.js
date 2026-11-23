import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mentions, isQuestion, calledBy } from '../src/names.js'
const A = ['Sudeep', 'Sudhi', 'Sudip']

test('name matches survive how whisper actually spells it', () => {
  assert.ok(mentions("Hi, I'm Sudhi. I'm a full stack developer", A)) // real whisper output for "Sudeep"
  assert.ok(mentions('Sudeep, can you take the deploy tonight?', A))
  assert.ok(mentions('sudeeep are you there', A))            // one edit
  assert.ok(!mentions('Sudeepa will take it', A))            // a different person
  assert.ok(!mentions('we ship the build tonight', A))
  assert.ok(!mentions('sure, deep dive later', A))
})

test('questions, including ones whisper wrote without a question mark', () => {
  assert.ok(isQuestion('So, what happens if we leave 90 minutes earlier? Does the answer change?'))
  assert.ok(isQuestion('Sudeep can you take the deploy tonight'))
  assert.ok(isQuestion('okay Sudeep, are you free after nine'))
  assert.ok(!isQuestion('Sudeep is taking the deploy tonight.'))
  assert.ok(!isQuestion('I checked the logs, nothing new since noon.'))
})

test('called means named and asked', () => {
  assert.ok(calledBy('Sudhi, can you take the deploy tonight?', A))
  assert.ok(!calledBy('Sudeep took the deploy last night.', A))
  assert.ok(!calledBy('Can someone take the deploy tonight?', A))
  assert.ok(!calledBy('Did Sudeep push the fix?', A))            // about the wearer, not to them
  assert.ok(!calledBy('Is Sudeep joining us later?', A))
  assert.ok(calledBy('Sudeep, which branch has the fix?', A))    // name as the address, no "you"
  assert.ok(calledBy('hey Sudhi are you free after nine', A))
})
