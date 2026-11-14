import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { cleanPrevious, stopPreviousApi } from '../electron/api-pid.ts'

async function fixture(t, value) {
  const dir = await mkdtemp(path.join(tmpdir(), 'vitalis-pid-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const file = path.join(dir, 'api.pid')
  await writeFile(file, value)
  return file
}

const ignore = async () => {}

test('ignores a corrupt PID and removes the file', async t => {
  const file = await fixture(t, '0x123')
  await cleanPrevious(file, () => assert.fail('invalid PID'), ignore)
  await assert.rejects(stat(file), { code: 'ENOENT' })
})

test('logs lookup failure and allows startup', async t => {
  const file = await fixture(t, '123')
  const messages = []
  await cleanPrevious(file, async () => { throw Error('lookup failed') }, async message => { messages.push(message) })
  assert.equal(messages.length, 1)
})

test('removes the PID of an absent process', { skip: process.platform !== 'win32' }, async t => {
  const file = await fixture(t, '4294967295')
  await cleanPrevious(file, pid => stopPreviousApi(pid, process.execPath, 'missing.jar'), async msg => assert.fail(msg))
  await assert.rejects(stat(file), { code: 'ENOENT' })
})

test('does not terminate an unrelated process', { skip: process.platform !== 'win32' }, async t => {
  const file = await fixture(t, String(process.pid))
  await cleanPrevious(file, pid => stopPreviousApi(pid, process.execPath, 'missing.jar'), async msg => assert.fail(msg))
  await assert.rejects(stat(file), { code: 'ENOENT' })
})

test('terminates only the expected executable with the exact JAR argument', { skip: process.platform !== 'win32' }, async t => {
  const jar = 'C:\\Vitalis Test\\vitalis-api.jar'
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '--', '-jar', jar, '--vitalis.desktop=true'])
  const exited = once(child, 'exit')
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill() })
  const file = await fixture(t, String(child.pid))
  await cleanPrevious(file, pid => stopPreviousApi(pid, process.execPath, jar), async msg => assert.fail(msg))
  await exited
  await assert.rejects(stat(file), { code: 'ENOENT' })
})
