import assert from 'node:assert/strict'
import Mocha from 'mocha'
import * as vscode from 'vscode'

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', color: true })
  const suite = Mocha.Suite.create(mocha.suite, 'Workflow Studio extension')

  suite.addTest(
    new Mocha.Test('activates and contributes the editor command', async () => {
      const extension = vscode.extensions.getExtension('fesnguyen.workflow-studio')
      assert.ok(extension, 'extension should be discoverable')
      await extension.activate()
      assert.ok((await vscode.commands.getCommands()).includes('workflowStudio.openEditor'))
      await vscode.commands.executeCommand('workflowStudio.openEditor')
    }),
  )

  suite.addTest(
    new Mocha.Test('opens file and resolves a qualified method with duplicate names', async () => {
      await vscode.commands.executeCommand('workflowStudio.navigateToSource', {
        filePath: 'navigation.ts',
        name: 'process',
        qualifiedName: 'Outer.process',
        parameters: [{ name: 'input', type: 'string' }],
      })
      assert.ok(vscode.window.activeTextEditor)
      assert.match(vscode.window.activeTextEditor.document.uri.fsPath, /navigation\.ts$/)
      assert.equal(vscode.window.activeTextEditor.selection.active.line, 3)
    }),
  )

  suite.addTest(
    new Mocha.Test('opens source files and resolves class declarations', async () => {
      await vscode.commands.executeCommand('workflowStudio.navigateToSource', {
        filePath: 'navigation.ts',
        name: 'Outer',
        qualifiedName: 'Outer',
      })
      assert.ok(vscode.window.activeTextEditor)
      assert.equal(vscode.window.activeTextEditor.selection.active.line, 0)
    }),
  )

  return new Promise((resolve, reject) => {
    mocha.run((failures) => {
      if (failures > 0) reject(new Error(`${failures} extension integration test(s) failed`))
      else resolve()
    })
  })
}
