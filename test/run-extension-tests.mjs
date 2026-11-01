import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runTests } from '@vscode/test-electron'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

try {
  await runTests({
    extensionDevelopmentPath: root,
    extensionTestsPath: path.join(root, 'out/test/runner.cjs'),
    launchArgs: [path.join(root, 'test/fixture'), '--disable-extensions', '--no-sandbox', '--disable-gpu'],
  })
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
