import { execFile } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { promisify } from 'node:util'

const execute = promisify(execFile)

export async function stopPreviousApi(pid: number, java: string, jar: string) {
  const script = [
    "$ErrorActionPreference = 'Stop';",
    '$p = Get-CimInstance Win32_Process -Filter "ProcessId = ' + pid + '";',
    '$jar = [regex]::Escape($env:VITALIS_EXPECTED_JAR);',
    '$argument = \'(?:^|\\s)-jar\\s+(?:"\' + $jar + \'"|\' + $jar + \')(?=\\s|$)\';',
    'if ($p -and $p.ExecutablePath -ieq $env:VITALIS_EXPECTED_JAVA -and',
    '$p.CommandLine -imatch $argument -and',
    '$p.CommandLine -match \'(?:^|\\s)--vitalis\\.desktop=true(?=\\s|$)\') {',
    'Stop-Process -Id ' + pid + ' -ErrorAction Stop',
    '}',
  ].join(' ')
  await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    env: { ...process.env, VITALIS_EXPECTED_JAVA: java, VITALIS_EXPECTED_JAR: jar },
    windowsHide: true,
    timeout: 5000,
  })
}

export async function cleanPrevious(
  file: string,
  stop: (pid: number) => Promise<void>,
  log: (message: string) => Promise<void>,
) {
  try {
    const saved = (await readFile(file, 'utf8')).trim()
    const pid = Number(saved)
    if (/^[1-9][0-9]*$/.test(saved) && Number.isSafeInteger(pid) && pid <= 0xffffffff) {
      await stop(pid)
    }
    await rm(file, { force: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      await log('Falha ao limpar o PID anterior da API. A abertura vai continuar.').catch(() => undefined)
    }
  }
}
