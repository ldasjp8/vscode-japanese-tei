import * as vscode from "vscode";
import { JSDOM } from "jsdom";

export function activate(context: vscode.ExtensionContext) {
  //パネルを作成する
  let panelGenerator = vscode.commands.registerCommand(
    "vscode-japanese-tei.openPreview",
    () => {
      const panel = vscode.window.createWebviewPanel(
        "openPreview",
        "vscode-japanese-tei",
        vscode.ViewColumn.Two,
        { enableScripts: true }
      );

      //初期値
      panel.webview.html = generatePanelContent(
        context.extensionUri,
        panel.webview
      );

      //エディタの内容を取得、パネルに反映
      const updateWebview = () => {
        panel.webview.html = generatePanelContent(
          context.extensionUri,
          panel.webview
        );
      };

      //イベントリスナ
      let activeEditor = vscode.window.activeTextEditor;

      //テキストが変動したら更新
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (activeEditor && event.document === activeEditor.document) {
          updateWebview();
        }
      });
    }
  );
  context.subscriptions.push(panelGenerator);

  const disposable = vscode.commands.registerCommand(
    "vscode-japanese-tei.insertApp",
    function () {
      // Get the active text editor
      const editor = vscode.window.activeTextEditor;

      if (editor) {
        const document = editor.document;
        const selection = editor.selection;

        // Get the word within the selection
        const word = document.getText(selection);
        //const reversed = word.split('').reverse().join('');
        const replacedWord = `<app><lem>${word}</lem><rdg></rdg></app>`;
        editor.edit((editBuilder) => {
          editBuilder.replace(selection, replacedWord);
        });
      }
    }
  );

  context.subscriptions.push(disposable);

  const insertWarichu = vscode.commands.registerCommand(
    "vscode-japanese-tei.insertWarichu",
    function () {
      // Get the active text editor
      const editor = vscode.window.activeTextEditor;

      if (editor) {
        const document = editor.document;
        const selection = editor.selection;

        // Get the word within the selection
        const word = document.getText(selection);
        //const reversed = word.split('').reverse().join('');
        const replacedWord = `<note type="割書"><seg type="warichu-right">${word}</seg><seg type="warichu-left"></seg></note>`;
        editor.edit((editBuilder) => {
          editBuilder.replace(selection, replacedWord);
        });
      }
    }
  );

  context.subscriptions.push(insertWarichu);

  const insertRuby = vscode.commands.registerCommand(
    "vscode-japanese-tei.insertRuby",
    function () {
      // Get the active text editor
      const editor = vscode.window.activeTextEditor;

      if (editor) {
        const document = editor.document;
        const selection = editor.selection;

        // Get the word within the selection
        const word = document.getText(selection);
        const replacedWord = `<ruby><rb>${word}</rb><rt></rt></ruby>`;
        editor.edit((editBuilder) => {
          editBuilder.replace(selection, replacedWord);
        });
      }
    }
  );

  context.subscriptions.push(insertRuby);
}

function generatePanelContent(
  _extensionUri: vscode.Uri,
  webview: vscode.Webview
) {
  let activeEditor = vscode.window.activeTextEditor;
  let text: string = "";
  if (activeEditor) {
    text = activeEditor.document.getText();
  }

  //xmlをhtmlに変換
  const html = convertXml2Html(text);

  const conf = vscode.workspace.getConfiguration("vscode-japanese-tei");
  const fontSize = conf.get("fontSize");

  let css = "";

  if (conf.get("useCustomStyle")) {
    css += conf.get("customStyle");
  }

  if (fontSize) {
    css += `
    body {
      font-size: ${fontSize};
    }
    `;
  }

  // Local path to main script run in the webview
  const scriptPathOnDisk = vscode.Uri.joinPath(
    _extensionUri,
    "media",
    "main.js"
  );

  // And the uri we use to load this script in the webview
  const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

  // Local path to css styles
  const styleCETEICeanPath = vscode.Uri.joinPath(
    _extensionUri,
    "media",
    "CETEIcean.css"
  );

  // Uri to load styles into webview
  const stylesCETEICeanUri = webview.asWebviewUri(styleCETEICeanPath);

  /*
  const oddName: any = conf.get("odd");
  if(oddName) {
    const oddPath = vscode.Uri.joinPath(
      _extensionUri,
      "media",
      `${oddName}.odd`
    );
    const uri = webview.asWebviewUri(oddPath).toString();
    let data = vscode.workspace.openTextDocument(uri);
  }
  */

  return (
    `<!DOCTYPE html>
  <html lang="ja">
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ` +
    (conf.get("useStylesCETEIcean")
      ? `<link href="${stylesCETEICeanUri}" rel="stylesheet">`
      : "") +
    `
      <style>
        ${css}
      </style>
      <title>vscode-japanese-tei</title>
    </head>
    <body id="main">
      ${html}
    </body>
    <script src="${scriptUri}"></script>
  </html> `
  );
}

export function deactivate() {}

//xmlをhtmlに変換する
function convertXml2Html(xml: string) {
  const jsdom = new JSDOM();
  const parser = new jsdom.window.DOMParser();

  //以下、要検討。<?xml?>の処理
  const spl = xml.split("?>");
  const fixedXml = spl[spl.length - 1];

  const dom = parser.parseFromString(fixedXml, "application/xml");

  const teiElement: any = dom.querySelector("TEI");

  const convertedElement = convert(dom, teiElement);

  let html = convertedElement.outerHTML;

  //空タグへの対応
  const emptyTags = html.match(/<.+?\/>/g);
  if (emptyTags) {
    for (const emptyTag of emptyTags) {
      const tmp = emptyTag.split("<");
      const tagName = tmp[tmp.length - 1].split(" ")[0];
      const replaced = emptyTag.replace(/\/>/, `></${tagName}>`);
      html = html.replace(emptyTag, replaced);
    }
  }

  return html;
}

//tei/xmlの要素をhtml(tei-xxx)に変換する
function convert(dom: any, e: any) {
  const nodeType = e.nodeType;
  //コメントの場合はスキップ
  if (nodeType === 8) {
    return null;
  } else if (nodeType === 3) {
    //テキストノードの場合
    return e.textContent;
  }

  const tagName = e.tagName;

  let convertedTag = `tei-${tagName}`;

  //例外対応（ruby関連のタグはそのまま）
  if (["ruby", "rb", "rt"].includes(tagName)) {
    convertedTag = tagName;
  }

  let replacement = dom.createElement(convertedTag);
  replacement.setAttribute("data-origname", `${tagName}`);

  for (let i = 0; i < e.attributes.length; i++) {
    const attr = e.attributes[i];
    const attrName = attr.name;
    let convertedAttrName = "data-" + attr.name;
    //スタイル属性はそのままコピー
    if (["style"].includes(attrName)) {
      convertedAttrName = attrName;
    }
    replacement.setAttribute(convertedAttrName, attr.value);
  }

  const children = e.childNodes;

  if (children.length === 0) {
    replacement.textContent = e.textContent;
  } else {
    for (const child of children) {
      const convertedElement = convert(dom, child);
      if (convertedElement) {
        replacement.append(convertedElement);
      }
    }
  }

  return replacement;
}
