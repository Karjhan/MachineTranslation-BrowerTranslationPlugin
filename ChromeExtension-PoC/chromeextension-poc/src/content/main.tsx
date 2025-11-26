type TextNodeInfo = {
  node: Text;
  original: string;
};

function collectVisibleTextNodes(): TextNodeInfo[] {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes: TextNodeInfo[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;

    const trimmed = node.textContent?.trim();
    if (!trimmed) continue;

    const parent = node.parentElement;
    if (
      parent &&
      ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)
    ) continue;

    const style = window.getComputedStyle(parent!);
    if (style.display === 'none' || style.visibility === 'hidden') continue;

    nodes.push({ node, original: node.textContent || '' });
  }

  return nodes;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'collectText') {
    const collected = collectVisibleTextNodes().map(n => n.original);
    console.log(`Collected ${collected.length} text nodes`);
    sendResponse({ texts: collected });
    return true;
  }

  if (message.type === 'applyTranslation') {
    const { translations } = message;
    const nodes = collectVisibleTextNodes();
    for (let i = 0; i < nodes.length && i < translations.length; i++) {
      nodes[i].node.textContent = translations[i];
    }
    console.log('Applied translated text');
    sendResponse({ success: true });
    return true;
  }
});
