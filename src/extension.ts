import * as vscode from "vscode";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

export function activate(context: vscode.ExtensionContext) {
  //パネルを作成する
  let panelGenerator = vscode.commands.registerCommand(
    "vscode-japanese-tei.openPreview",
    async () => {
      const panel = vscode.window.createWebviewPanel(
        "openPreview",
        "vscode-japanese-tei",
        vscode.ViewColumn.Two,
        { enableScripts: true }
      );

      //初期値
      panel.webview.html = await generatePanelContent(
        context.extensionUri,
        panel.webview
      );

      //エディタの内容を取得、パネルに反映
      const updateWebview = async () => {
        const html = await generatePanelContent(context.extensionUri,
          panel.webview);
        panel.webview.html = html;
      };

      
      //テキストが変動したら更新
      vscode.workspace.onDidChangeTextDocument((event) => {
        const activeEditor = vscode.window.activeTextEditor;
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
        const replacedWord = `<note type="割書">
        <seg type="warichu-right">${word}</seg>
        <milestone unit="wbr"/>
        <seg type="warichu-left"></seg>
        </note>`;
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

async function generatePanelContent(
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

  // Uri to load styles into webview
  let stylesCETEICeanUri = "";

  const oddName: any = conf.get("odd");
  if (oddName) {
    const oddPath = vscode.Uri.joinPath(
      _extensionUri,
      "media",
      "odd",
      `${oddName}.odd`
    );
    css += await convertOdd2Css(oddPath);
  }

  //CETEIceanのCSSを読み込む
  if (conf.get("useStylesCETEIcean")) {
    // Local path to css styles
    const styleCETEICeanPath = vscode.Uri.joinPath(
      _extensionUri,
      "media",
      "CETEIcean.css"
    );

    const ceteiceanUri = webview.asWebviewUri(styleCETEICeanPath);
    stylesCETEICeanUri = `<link href="${ceteiceanUri}" rel="stylesheet">`;
  }

  //カスタムスタイル
  if (conf.get("useCustomStyle")) {
    css += conf.get("customStyle");
  }

  return (
    `<!DOCTYPE html>
  <html lang="ja">
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ` +
    stylesCETEICeanUri +
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

//oddファイルをcssに変換する
async function convertOdd2Css(oddPath: vscode.Uri) {
  let css = "";

  const doc = await vscode.workspace.openTextDocument(oddPath);

  const oddStr = doc.getText();

  const dom = new DOMParser().parseFromString(oddStr, "text/xml");
  const elementSpecs: any = dom.getElementsByTagName("elementSpec");

  if (elementSpecs) {
    for(let i = 0; i < elementSpecs.length; i++){
      //for (const elementSpec of elementSpecs) {
      const elementSpec = elementSpecs[i];
      const ident = elementSpec.getAttribute("ident");
      //const models = elementSpec.querySelectorAll("model");
      const models = elementSpec.getElementsByTagName("model");
      //for (const model of models) {
      for(let j = 0; j < models.length; j++){
        const model = models[j];
        let selector = `${ident}`;
        if (model.getAttribute("predicate")) {
          const predicate = model.getAttribute("predicate");
          const attr =
            predicate.replace("@", "[").split("&#34;").join('"') + "]";
          selector = `${ident}${attr}`;
        }
        //const outputRendition = model.querySelector("outputRendition");
        const outputRendition = model.getElementsByTagName("outputRendition")[0];
        if (outputRendition) {
          css += `${selector} {
            ${outputRendition.textContent}
          }`;
        }
      }
    }
  }
  return css;
}

//xmlをhtmlに変換する
function convertXml2Html(xml: string) {
  let doc = new DOMParser().parseFromString(xml, "text/xml");

  const gs = doc.getElementsByTagName("g");

  const glyphs = doc.getElementsByTagName("glyph");
  const glyphMap: any = {};
  for (let i = 0; i < glyphs.length; i++) {
    const g = glyphs[i];

    const ref: any = g.getAttribute("xml:id");
    const mappings = g.getElementsByTagName("mapping");
    let mappingValue: any = "";
    //altがあればaltを使う
    let mappingAltValue = "";
    for(let j = 0; j < mappings.length; j++){
      const mapping = mappings[j];
      const type = mapping.getAttribute("type");
      mappingValue = mapping.textContent;
      //altがあればaltを使う
      if(type === "alt"){
        mappingAltValue = mappingValue;
      }
    }
    //altがなければ、他のmappingを使う
    if(mappingAltValue === ""){
      mappingAltValue = mappingValue;
    }
    glyphMap[ref] = mappingAltValue;
  }

  const replaceList = [];

  for (let i = 0; i < gs.length; i++) {
    const g: any = gs[i];
    const ref = g.getAttribute("ref").replace("#", "");
    if(glyphMap[ref]){
      const unicode = glyphMap[ref];
      const newElement = doc.createElement(`span data-origname="g"`);
      newElement.textContent = unicode;
      replaceList.push({g, newElement});
    }
  }

  for(const replaceObj of replaceList){
    const {g, newElement} = replaceObj;
    g.parentNode.replaceChild(newElement, g);
  }

  let html = new XMLSerializer().serializeToString(doc);
  html = openEmptyTags(html);
  return html;

  /*
  const jsdom = new JSDOM();
  const parser = new jsdom.window.DOMParser();

  //以下、要検討。<?xml?>の処理
  const spl = xml.split("?>");
  const fixedXml = spl[spl.length - 1];

  const dom = parser.parseFromString(fixedXml, "application/xml");

  const teiElement: any = dom.querySelector("TEI");

  const convertedElement = convert(dom, teiElement);

  if (!convertedElement) {
    return "";
  }

  let html = convertedElement.outerHTML;
  return html;
  */
}

//空タグへの対応
function openEmptyTags(html: string){
  const emptyTags = html.match(/<.+?\/>/g);
  if (emptyTags) {
    for (const emptyTag of emptyTags) {
      const tmp = emptyTag.split("<");
      const tagName = tmp[tmp.length - 1].split(" ")[0];
      const replaced = emptyTag.replace(/\/>/, `></${tagName}>`).replace(">>", ">");
      html = html.replace(emptyTag, replaced);
    }
  }
  return html;
}

//tei/xmlの要素をhtml(tei-xxx)に変換する
function convert(dom: any, e: any) {
  if (!e) {
    return null;
  }
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