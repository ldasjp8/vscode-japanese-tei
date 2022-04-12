const vscode = acquireVsCodeApi();
const previousState = vscode.getState();

window.onload = function() {
  //縦書き画面の先頭に移動する
  let scrollPositionX = window.outerWidth;

  //stateにスクロール位置が残っていればそれを使う
  if (previousState && previousState.scrollPositionX) {
    scrollPositionX = previousState.scrollPositionX;
  }
  window.scroll(scrollPositionX, 0);
};

//スクロール位置を保存する
window.onscroll = () => {
  const scrollPositionX = window.pageXOffset;
  vscode.setState({ scrollPositionX });
};
