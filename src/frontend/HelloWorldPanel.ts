import * as vscode from "vscode";
import { TreeItem } from "vscode";
import { getNonce } from "./getNonce";
import { CortexDebugExtension } from './extension';
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
  private stringArray: string[] = [];
  private memArray: number[] = [];
  private addresses: string[] = [];
  public static paramAdd: string;
  public static paramLen: string;
  public static paramDim: string[];
  public static paramSize: string;
  public static divider: number;
  private stringLen: number;
  private spSave: number = 0;
  private spDiff: number;
  private spAccum: number = 0;
  private static viewState: number = 0;



  public static checkView(view: string){
    if(view == '1d'){
      this.viewState = 1;
    }
    else if(view == '2d'){
      this.viewState = 2;
    }
    else if(view == 'ascii'){
      this.viewState = 3;
    }
    else if(view == 'stack'){
      this.viewState = 4;
    }
  }

  public static createOrShow(extensionUri: vscode.Uri, address: string, length: string, view: string, memSize: string) {
    HelloWorldPanel.paramAdd = address;
    HelloWorldPanel.checkView(view);
    HelloWorldPanel.paramSize = memSize;
    this.divider = this.getDivider();
    if(this.viewState == 2){
      var splitted = length.split('x');
      HelloWorldPanel.paramDim = splitted;
      var lengthInt = parseInt(splitted[0], 10) * parseInt(splitted[1], 10) * this.divider;
      HelloWorldPanel.paramLen = lengthInt.toString();
    }
    else{
      HelloWorldPanel.paramLen = length;
    }
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
          vscode.Uri.joinPath(extensionUri, "src/media"),
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
      this.memArray[i] = this.bytes[j];
    }
  }

  public countStringLen(){
    var i = 0;
    var len = 0;
    var end = false;
    while(end == false){
      if(this.bytes[i] != 0){
        len++;
      }
      else{
        i--;
        end = true;
      }
      i++
    }
    return i;
  }

  public decToAscii(){
    for(var i = 0; i < this.stringLen; i++){
      this.stringArray[i] = String.fromCharCode(this.bytes[i])
    }
  }

  public static getDivider(){
    if(HelloWorldPanel.paramSize == 'word'){
      return 4;
    }
    else if(HelloWorldPanel.paramSize == 'half-word'){
      return 2;
    }
    else{
      return 1;
    }
  }

  public async _update() {
    const webview = this._panel.webview;
    const session = CortexDebugExtension.getActiveCDSession();
    
    if(HelloWorldPanel.viewState == 4){
      session.customRequest('read-registers').then((data) => {
        const addressInt = parseHexOrDecInt(HelloWorldPanel.paramAdd);
        const sp = parseHexOrDecInt(data[13].value);
        if(this.spSave == addressInt){
          this.spDiff = this.spSave - sp;
        }
        if(sp < this.spSave){
          this.spAccum += 1
        }
        this.spSave = sp;
        let dataLength = parseInt(HelloWorldPanel.paramLen, 10);
        const startAdd = addressInt - dataLength;
        dataLength += 4
        HelloWorldPanel.paramLen = dataLength.toString()
        session.customRequest('read-memory', { address: startAdd, length: HelloWorldPanel.paramLen }).then((data) => {
                this.bytes = data.bytes;
                const address = parseHexOrDecInt(data.startAddress);
                this.getAddresses(address, HelloWorldPanel.divider, dataLength);
                this._panel.webview.html = this._getHtmlForWebview(webview);
            });
          });
    }
    else{
      session.customRequest('read-memory', { address: HelloWorldPanel.paramAdd, length: HelloWorldPanel.paramLen }).then((data) => {
                this.bytes = data.bytes;
                const address = parseHexOrDecInt(data.startAddress);
                this.getAddresses(address, HelloWorldPanel.divider, parseInt(HelloWorldPanel.paramLen, 10));
                this.stringLen = this.countStringLen();
                this.decToAscii();
                this._panel.webview.html = this._getHtmlForWebview(webview);
            });
    }        
    

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
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    // Local path to css styles
    const styleResetPath = vscode.Uri.joinPath(
      this._extensionUri,
      "src/media",
      "reset.css"
    );
    const stylesPathMainPath = vscode.Uri.joinPath(
      this._extensionUri,
      "src/media",
      "vscode.css"
    );
    // Uri to load styles into webview
    const stylesResetUri = webview.asWebviewUri(styleResetPath);
    const stylesMainUri = webview.asWebviewUri(stylesPathMainPath);

    const nonce = getNonce();
    let repeatNum = 1;
    switch(HelloWorldPanel.viewState) { 
      case 1: { 
         repeatNum = 1;
         break; 
      }
      case 2: { 
        repeatNum = parseInt(HelloWorldPanel.paramDim[1], 10);
        break; 
      }
      case 3: { 
        repeatNum = this.stringLen; 
        break; 
      }  
      case 4: {
        repeatNum = 1;
        break;
      }
      default: { 
        repeatNum = 1; 
         break; 
      } 
    }
    
    var html1D = `<!DOCTYPE html>
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
        grid-template-columns: 1fr repeat(${repeatNum}, 3fr) 1fr;
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
      <div class="grid-item"><b>index</b></div>`

    for(var i = 0; i < this.addresses.length; i++){
      html1D += `
      <div class="grid-item">${this.addresses[i]}</div>
      <div class="grid-item">${this.memArray[i]}</div>
      <div class="grid-item">${i}</div>
      `
    }
    html1D += `
    </div>
    </body>
    </html>`


    var html2D = `<!DOCTYPE html>
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
          grid-template-columns: 1fr repeat(${repeatNum}, 3fr);
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
        <div class="grid-item"><b>address</b></div>`
      for(var i = 0; i < repeatNum; i++){
        html2D += 
        `<div class="grid-item">+${HelloWorldPanel.divider}</div>`
      }
      for(var i = 0; i < this.addresses.length; i++){
        if(i == 0 || i % repeatNum == 0){
          html2D += `<div class="grid-item">${this.addresses[i]}</div>`
        }
        html2D +=
        `<div class="grid-item">${this.memArray[i]}</div>`
      }
      html2D += 
      `</div>
			</body>
			</html>`;
    
    

    var htmlAscii = `<!DOCTYPE html>
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
          grid-template-columns: 1fr repeat(${repeatNum}, 1fr);
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
        <div class="grid-item">${this.addresses[0]}</div>`
      for(var i = 0; i < this.stringLen; i++){
        htmlAscii += `
        <div class="grid-item">${this.stringArray[i]}</div>`
      }
      htmlAscii += `
      </div>
			</body>
			</html>`



    var htmlStack = `<!DOCTYPE html>
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
          grid-template-columns: 1fr repeat(${repeatNum}, 3fr) 1fr;
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
        .grid-item2 {
          background-color: rgba(255, 255, 255, 1);
          color: rgba(128, 128, 128, 1);
          border: 1px solid rgba(0, 0, 0, 0.8);
          padding: 20px;
          font-size: 30px;
          text-align: center;
        }
        </style>
      </head>
      <body>
      <div class="grid-container">
        <div class="grid-item"><b>Address</b></div>
        <div class="grid-item"><b>Memory</b></div>
        <div class="grid-item"><b>Stack Pointer</b></div>`

      const last = this.addresses.length - 1
      for(var i = last; i >= last - ((this.spDiff*this.spAccum)/HelloWorldPanel.divider); i--){
        if(this.addresses[i] < hexFormat(this.spSave, 8, true)){ 
          htmlStack += `
          <div class="grid-item2">${this.addresses[i]}</div>
          <div class="grid-item2">${this.memArray[i]}</div>
          <div class="grid-item2"></div>`
        }
        else{
          htmlStack += `
          <div class="grid-item">${this.addresses[i]}</div>
          <div class="grid-item">${this.memArray[i]}</div>`
          if(this.addresses[i] == hexFormat(this.spSave, 8, true)){
            htmlStack+=`
            <div class="grid-item"><-sp</div>
            `
          }
          else{
            htmlStack+=`
            <div class="grid-item"></div>
            `
          }
        }
      }
      htmlStack += `
      </div>
      </body>
      </html>`


    


    switch(HelloWorldPanel.viewState) { 
      case 1: { 
         return html1D; 
         break; 
      }
      case 2: { 
        repeatNum = 3;
        return html2D; 
        break; 
      }
      case 3: { 
        return htmlAscii; 
        break; 
      }  
      case 4: { 
        return htmlStack; 
        break; 
      } 
      default: { 
        return html1D; 
         break; 
      } 
    } 
  }
}
