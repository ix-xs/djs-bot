# djs-bot Snippets (VS Code)

Type a prefix and press <kbd>Tab</kbd> to scaffold any `@ix-xs/djs-bot` building
block, in TypeScript **or** JavaScript.

| Prefix | Scaffolds |
| --- | --- |
| `dbot` | bot entry (`defineBot`) |
| `dcommand` | slash command |
| `dsub` | command with subcommands |
| `devent` | gateway event |
| `dbutton` | typed button |
| `dselect` | string select menu |
| `dmodal` | modal |
| `duser` | user context menu |
| `dmessage` | message context menu |
| `dtrigger` | message auto-responder |
| `djob` | scheduled job |
| `dservice` | injectable service |
| `dplugin` | plugin |
| `dfeature` | feature pack |

## Use it without installing (per-project)

Copy [`snippets/djs-bot.code-snippets`](./snippets/djs-bot.code-snippets) into
your project's `.vscode/` folder. That's it - the prefixes are available in that
workspace.

## Install as an extension

```bash
cd editors/vscode
npm install -g @vscode/vsce
vsce package          # produces djs-bot-snippets-1.0.0.vsix
code --install-extension djs-bot-snippets-1.0.0.vsix
```

Or publish it to the Marketplace with `vsce publish` (requires a publisher).
