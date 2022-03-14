import * as vscode from "vscode";
import { TreeItem } from "vscode";
import { getNonce } from "./getNonce";
import { getRegisters } from "./getRegisters";
import { RegisterNode, RegisterValue } from "./views/nodes/registernode";
import { CortexDebugExtension } from './extension';
import internal = require("stream");

export class HelloWorldPanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  
  public static currentPanel: HelloWorldPanel | undefined;

  public static readonly viewType = "hello-world";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private registers: RegisterNode[] = [];
  private registerMap: { [index: number]: RegisterNode } = {};
  private loaded: boolean = false;
  public myTreeItem: TreeItem;
  public wsFolderPath: string;

  // public newNameRefreshRegisterValues() {
  //   const session = CortexDebugExtension.getActiveCDSession();
  //   session.customRequest('read-registers').then((data) => {
  //     console.log("Function Called");
  //       data.forEach((reg, idx) => {
  //         if (reg) {
  //           //const rn = new RegisterNode(reg, idx);
  //           this.registers.push(reg);
  //           this.registerMap[idx] = reg;
  //         }
  //           // const index = parseInt(reg.number, 10);
  //           // const regNode = this.registerMap[index];
  //           // if (regNode) { regNode.setValue(reg.value); }
  //       });
  //   });
  // }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (HelloWorldPanel.currentPanel) {
      HelloWorldPanel.currentPanel._panel.reveal(column);
      HelloWorldPanel.currentPanel._update();
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      HelloWorldPanel.viewType,
      "Visuals",
      column || vscode.ViewColumn.One,
      {
        // Enable javascript in the webview
        enableScripts: true,

        // And restrict the webview to only loading content from our extension's `media` directory.
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "media"),
          vscode.Uri.joinPath(extensionUri, "out/compiled"),
        ],
      }
    );

    HelloWorldPanel.currentPanel = new HelloWorldPanel(panel, extensionUri);
  }

  public static kill() {
    HelloWorldPanel.currentPanel?.dispose();
    HelloWorldPanel.currentPanel = undefined;
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    HelloWorldPanel.currentPanel = new HelloWorldPanel(panel, extensionUri);
  }

  private constructor(
    panel: vscode.WebviewPanel, 
    extensionUri: vscode.Uri)
    //public session: vscode.DebugSession) 
    {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // // Handle messages from the webview
    // this._panel.webview.onDidReceiveMessage(
    //   (message) => {
    //     switch (message.command) {
    //       case "alert":
    //         vscode.window.showErrorMessage(message.text);
    //         return;
    //     }
    //   },
    //   null,
    //   this._disposables
    // );
  }

  public dispose() {
    HelloWorldPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private async _update() {
    const webview = this._panel.webview;

    this._panel.webview.html = this._getHtmlForWebview(webview);
    webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        
        case "onInfo": {
          if (!data.value) {
            return;
          }
          vscode.window.showInformationMessage(data.value);
          break;
        }
        case "onError": {
          if (!data.value) {
            return;
          }
          vscode.window.showErrorMessage(data.value);
          break;
        }
        // case "tokens": {
        //   await Util.globalState.update(accessTokenKey, data.accessToken);
        //   await Util.globalState.update(refreshTokenKey, data.refreshToken);
        //   break;
        // }
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // // And the uri we use to load this script in the webview
    // const scriptUri = webview.asWebviewUri(
    //   vscode.Uri.joinPath(this._extensionUri, "out", "compiled/swiper.js")
    // );

    // Local path to css styles
    const styleResetPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "reset.css"
    );
    const stylesPathMainPath = vscode.Uri.joinPath(
      this._extensionUri,
      "media",
      "vscode.css"
    );

    // Uri to load styles into webview
    const stylesResetUri = webview.asWebviewUri(styleResetPath);
    const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);
    // const cssUri = webview.asWebviewUri(
    //   vscode.Uri.joinPath(this._extensionUri, "out", "compiled/swiper.css")
    // );

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();
    // this.newNameRefreshRegisterValues()
    const after = 0;


    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
        -->
        <meta http-equiv="Content-Security-Policy" content="img-src https: data:; style-src 'unsafe-inline' ${
      webview.cspSource
    }; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${stylesResetUri}" rel="stylesheet">
        <link href="${stylesMainUri}" rel="stylesheet">
        <script nonce="${nonce}">
        </script>
        <style>
        .grid-container {
          display: grid;
          grid-template-columns: auto auto auto;
          background-color: #2196F3;
          padding: 0px;
        }
        .grid-item {
          background-color: rgba(255, 255, 255, 1);
          border: 1px solid rgba(0, 0, 0, 0.8);
          padding: 20px;
          font-size: 30px;
          text-align: center;
        }
        </style>
			</head>
      <body>
      <h1>Hello World</h1>
      <div class="grid-container">
        <div class="grid-item">address</div>
        <div class="grid-item">memory</div>
        <div class="grid-item">index</div>
        <div class="grid-item">0x20000028</div>
        <div class="grid-item">${this.registers[1]}</div>
        <div class="grid-item"></div>
        <div class="grid-item">0x20000024</div>
        <div class="grid-item">above this</div>
        <div class="grid-item">5</div>
        <div class="grid-item">0x20000020</div>
        <div class="grid-item">28</div>
        <div class="grid-item">4</div>
        <div class="grid-item">0x2000001C</div>
        <div class="grid-item">30</div>
        <div class="grid-item">3</div>
        <div class="grid-item">0x20000018</div>
        <div class="grid-item">17</div>
        <div class="grid-item">2</div>
        <div class="grid-item">0x20000014</div>
        <div class="grid-item">31</div>
        <div class="grid-item">1</div>
        <div class="grid-item">0x20000010</div>
        <div class="grid-item">5</div>
        <div class="grid-item">0</div>
        <div class="grid-item">0x2000000C</div>
        <div class="grid-item">????????</div>
        <div class="grid-item"></div>
      </div>
			</body>
			</html>`;
  }
}