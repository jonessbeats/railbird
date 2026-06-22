import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MODEL_VERSION } from '../version'

test('MODEL_VERSION is a non-empty string', () => {
  assert.equal(typeof MODEL_VERSION, 'string')
  assert.ok(MODEL_VERSION.length > 0)
})
