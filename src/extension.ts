import * as vscode from "vscode";
import { JSDOM } from "jsdom";

export function activate(context: vscode.ExtensionContext) {

  //パネルを作成する
  let panelGenerator = vscode.commands.registerCommand(
    "vscode-japanese-tei.openPreview",
    () => {
      const panel = vscode.window.createWebviewPanel(
        "openPreview",
        "プレビュー",
        vscode.ViewColumn.Two,
        { enableScripts: true }
      );
      
      //初期値
      panel.webview.html = generatePanelContent();

      //エディタの内容を取得、パネルに反映
      const updateWebview = () => {
        panel.webview.html = generatePanelContent();
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

  const disposable = vscode.commands.registerCommand('vscode-japanese-tei.insertApp', function () {
		// Get the active text editor
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const document = editor.document;
			const selection = editor.selection;

			// Get the word within the selection
			const word = document.getText(selection);
			//const reversed = word.split('').reverse().join('');
      const replacedWord = ["<app>",  "<lem>", word, "</lem>", "<rdg>", "</rdg>", "</app>"].join("");
			editor.edit(editBuilder => {
				editBuilder.replace(selection, replacedWord);
			});
		}
	});

	context.subscriptions.push(disposable);

  const insertWarichu = vscode.commands.registerCommand('vscode-japanese-tei.insertWarichu', function () {
		// Get the active text editor
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const document = editor.document;
			const selection = editor.selection;

			// Get the word within the selection
			const word = document.getText(selection);
			//const reversed = word.split('').reverse().join('');
      const replacedWord = [`<note type="割書">`, '<seg type="warichu-right">', word, "</seg>", `<seg type="warichu-left">`, "</seg>", "</note>"].join("");
			editor.edit(editBuilder => {
				editBuilder.replace(selection, replacedWord);
			});
		}
	});

	context.subscriptions.push(insertWarichu);

  const insertRuby = vscode.commands.registerCommand('vscode-japanese-tei.insertRuby', function () {
		// Get the active text editor
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			const document = editor.document;
			const selection = editor.selection;

			// Get the word within the selection
			const word = document.getText(selection);
      const replacedWord = [`<ruby>`, '<rb>', word, "</rb>", `<rt>`, "</rt>", "</ruby>"].join("");
			editor.edit(editBuilder => {
				editBuilder.replace(selection, replacedWord);
			});
		}
	});

	context.subscriptions.push(insertRuby);
}

function generatePanelContent() {
  let activeEditor = vscode.window.activeTextEditor;
  let text: string = "";
  if (activeEditor) {
    text = activeEditor.document.getText();
  }

  //xmlをhtmlに変換
  const html = convertXml2Html(text);

  const css = `

  #main {
    overflow-y: auto;
    writing-mode: vertical-rl;
  }

  /* teiHeader */
  tei-teiHeader {
    display: none;
  }

  /* p */
  tei-p {
    display: block;
  }

  tei-date {
    background-color: lightblue;
  }

  tei-persName {
    background-color: lightsalmon;
  }

  tei-placeName {
    background-color: lightgreen;
  }

  *[data-type="book"] {
    color: green;
  }

  *[data-type="page"] {
    background-color: gray;
  }
  
  tei-lb:after {
    content: '\\a';
    white-space: pre;
  }

  *[data-type="割書"] {
    display: inline-table;
    vertical-align: top;
  }

  tei-seg[data-type="warichu-right"], tei-seg[data-type="warichu-left"] {
    font-size: 50%;
    display: table-row;
  }

  *[data-type="zodiac"] {
    color: royalblue;
  }

  `;

  return `<!DOCTYPE html>
  <html lang="ja">
    <head>
      <style>
        ${css}
      </style>
    </head>
    <body id="main">
      ${html}
    </body>
    <script>
    const vscode = acquireVsCodeApi();
    const previousState = vscode.getState();

    window.setTimeout(function(){
      //縦書き画面の先頭に移動する
      let scrollPositionX = window.outerWidth

      //stateにスクロール位置が残っていればそれを使う
      if(previousState && previousState.scrollPositionX){
        scrollPositionX = previousState.scrollPositionX
      }
      window.scroll(scrollPositionX, 0);
    }, 1);

    //スクロール位置を保存する
    window.onscroll = () => {
      const scrollPositionX = window.pageXOffset;
      vscode.setState({ scrollPositionX });
    };
    </script>
  </html> `;
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
  for(const emptyTag of emptyTags){
    const tmp = emptyTag.split("<");
    const tagName = tmp[tmp.length-1].split(" ")[0];
    const replaced = emptyTag.replace(/\/>/, `></${tagName}>`);
    html = html.replace(emptyTag, replaced);
  }

  return html;
}

//tei/xmlの要素をhtml(tei-xxx)に変換する
function convert(dom:any, e: any) {
  const nodeType = e.nodeType;
  //コメントの場合はスキップ
  if(nodeType === 8){
    return null;
  } else if(nodeType === 3){ //テキストノードの場合
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
      if(convertedElement){
        replacement.append(convertedElement);
      }
    }
  }

  return replacement;
}