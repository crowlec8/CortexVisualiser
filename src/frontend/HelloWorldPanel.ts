import * as vscode from "vscode";
import { TreeItem } from "vscode";
import { getNonce } from "./getNonce";
import { RegisterNode, RegisterValue } from "./views/nodes/registernode";
import { CortexDebugExtension } from './extension';
import internal = require("stream");
import { parseHexOrDecInt } from "../common";
import { hexFormat } from './utils';

export class HelloWorldPanel {
  /**
   * Track the currently panel. Only allow a single panel to exist at a time.
   */
  
  public static currentPanel: HelloWorldPanel | undefined;

  public static readonly viewType = "hello-world";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  public myTreeItem: TreeItem;
  public wsFolderPath: string;
  private bytes: number;
  private bytesArray: number[] = [];
  private addresses: string[] = [];
  public static paramAdd: string;
  public static paramLen: string;

  public static createOrShow(extensionUri: vscode.Uri, address: string, length: string) {
    HelloWorldPanel.paramAdd = address;
    HelloWorldPanel.paramLen = length;
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

  public getAddresses(startAddress: number, gap: number, length: number){
    // gap is equal to the size of blocks we want to look at 4 = word,,,, 4 bytes = 32bits
    for(let i = 0; i < length/gap; i ++){
      let j = i * gap;
      this.addresses[i] = hexFormat((startAddress + j), 8, true);
      this.bytesArray[i] = this.bytes[j];
    }
  }

  private parseQuery(queryString) {
    const query = {};
    function addToQuery(str: string) {
        const pair = str.split('=');
        const name = pair.shift();      // First part is name
        query[name] = pair.join('=');   // Rest is the value
    }
    // THe API has already decoded the Uri or else we could have just split on '&' and '=' and be order-independent
    // We know that we will have three parameters and it is the first one that will have complex stuff in it
    const pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
    addToQuery(pairs.pop());            // get timestamp
    addToQuery(pairs.pop());            // get length
    addToQuery(pairs.join('&'));        // Rest is the addr-expression
    return query;
  }

  public async _update() {
    const webview = this._panel.webview;
    const session = CortexDebugExtension.getActiveCDSession();
    
    session.customRequest('read-memory', { address: HelloWorldPanel.paramAdd, length: HelloWorldPanel.paramLen }).then((data) => {
            this.bytes = data.bytes;
            const address = parseHexOrDecInt(data.startAddress);
            this.getAddresses(address, 4, parseInt(HelloWorldPanel.paramLen, 10));
            this._panel.webview.html = this._getHtmlForWebview(webview);
        });
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
          color: rgba(0, 0, 0, 1);
          border: 1px solid rgba(0, 0, 0, 0.8);
          padding: 20px;
          font-size: 30px;
          text-align: center;
        }
        </style>
			</head>
      <body>
      <div class="grid-container">
        <div class="grid-item"><b>address</b></div>
        <div class="grid-item"><b>memory</b></div>
        <div class="grid-item"><b>index</b></div>
        <div class="grid-item">${this.addresses[0]}</div>
        <div class="grid-item">${this.bytesArray[0]}</div>
        <div class="grid-item">0</div>
        <div class="grid-item">${this.addresses[1]}</div>
        <div class="grid-item">${this.bytesArray[1]}</div>
        <div class="grid-item">1</div>
        <div class="grid-item">${this.addresses[2]}</div>
        <div class="grid-item">${this.bytesArray[2]}</div>
        <div class="grid-item">2</div>
        <div class="grid-item">${this.addresses[3]}</div>
        <div class="grid-item">${this.bytesArray[3]}</div>
        <div class="grid-item">3</div>
        <div class="grid-item">${this.addresses[4]}</div>
        <div class="grid-item">${this.bytesArray[4]}</div>
        <div class="grid-item">4</div>
        <div class="grid-item">${this.addresses[5]}</div>
        <div class="grid-item">${this.bytesArray[5]}</div>
        <div class="grid-item">5</div>
        <div class="grid-item">${this.addresses[6]}</div>
        <div class="grid-item">${this.bytesArray[6]}</div>
        <div class="grid-item">6</div>
        <div class="grid-item">${this.addresses[7]}</div>
        <div class="grid-item">${this.bytesArray[7]}</div>
        <div class="grid-item">7</div>
        <div class="grid-item">${this.addresses[8]}</div>
        <div class="grid-item">${this.bytesArray[8]}</div>
        <div class="grid-item">8</div>
        <div class="grid-item">${this.addresses[9]}</div>
        <div class="grid-item">${this.bytesArray[9]}</div>
        <div class="grid-item">9</div>
      </div>
			</body>
			</html>`;
  }
}