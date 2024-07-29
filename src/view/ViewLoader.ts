import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class ViewLoader {
  public static currentPanel?: vscode.WebviewPanel;

  private panel: vscode.WebviewPanel;
  private context: vscode.ExtensionContext;
  private disposables: vscode.Disposable[];

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.disposables = [];

    this.panel = vscode.window.createWebviewPanel(
      'reactApp', 
      '批量新增翻译', 
      vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'dist'))],
      }
    );

    this.renderWebview();

    this.panel.webview.onDidReceiveMessage(
      (message: any) => {
        // 自定义命令，传递给上一层
        vscode.commands.executeCommand('extension.du.i18n.receive', message);
      },
      null,
      this.disposables
    );

    this.panel.onDidDispose(
      () => {
        this.dispose();
      },
      null,
      this.disposables
    );
  }

  private renderWebview() {
    const baseUri = this.panel.webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'dist/app.js'))
    );
    // const htmlPath = path.join(this.context.extensionPath, 'src/view/index.html');
    // const html = fs.readFileSync(htmlPath, 'utf-8');
    // this.panel.webview.html = html.replace(`<script src=""></script>`, `<script src="${baseUri}"></script>`);
    // 因为打包还要额外处理html文件，还不如直接用字符串方便
    this.panel.webview.html = `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>React App</title>
      </head>
      <body>
        <div id="root"></div>
        <script>
          const vscode = acquireVsCodeApi();
        </script>
        <script src="${baseUri}"></script>
      </body>
    </html>`;
  }

  static showWebview(context: vscode.ExtensionContext) {
    const cls = this;
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;
    if (cls.currentPanel) {
      cls.currentPanel.reveal(column);
    } else {
      cls.currentPanel = new cls(context).panel;
    }
  }

  static postMessageToWebview(message: any) {
    const cls = this;
    if (cls.currentPanel) {
      cls.currentPanel?.webview.postMessage(message);
    }
  }

  public dispose() {
    ViewLoader.currentPanel = undefined;

    // Clean up our resources
    this.panel.dispose();

    while (this.disposables.length) {
      const x = this.disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
