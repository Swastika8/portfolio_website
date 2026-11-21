export async function portfolioRequest(path, payload) {
  const options = payload === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new Error(navigator.onLine === false
      ? 'You’re offline. Reconnect and try again.'
      : 'Couldn’t reach the portfolio. Try again in a moment.');
  }
  if (!response.headers.get('content-type')?.includes('application/json')) {
    if (response.status === 404) throw new Error('This page is unavailable.');
    throw new Error(response.status >= 500
      ? 'The portfolio is temporarily unavailable. Try again in a moment.'
      : 'Open this page through the portfolio server.');
  }
  const data = await response.json().catch(() => { throw new Error('The portfolio returned an incomplete response.'); });
  if (!response.ok) throw new Error(data.error || 'The portfolio could not finish this request.');
  return data;
}

export function formatDate(value) {
  return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}

function inline(text, parent) {
  const markup = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)|\x60([^\x60]+)\x60|\*\*([^*]+)\*\*/g;
  let offset = 0;
  for (const match of text.matchAll(markup)) {
    parent.append(text.slice(offset, match.index));
    const item = document.createElement(match[1] ? 'a' : match[3] ? 'code' : 'strong');
    item.textContent = match[1] || match[3] || match[4];
    if (match[2]) {
      item.href = match[2];
      item.rel = 'noreferrer';
    }
    parent.append(item);
    offset = match.index + match[0].length;
  }
  parent.append(text.slice(offset));
}

export function renderJournalText(source, target) {
  const content = document.createDocumentFragment();
  let paragraph = [];
  let codeLines = null;
  let list = null;

  function finishParagraph() {
    if (!paragraph.length) return;
    const node = document.createElement('p');
    inline(paragraph.join(' '), node);
    content.append(node);
    paragraph = [];
  }

  function finishCode() {
    const pre = document.createElement('pre');
    const code = document.createElement('code');
    code.textContent = codeLines.join('\n');
    pre.append(code);
    content.append(pre);
    codeLines = null;
  }

  for (const line of source.replaceAll('\r\n', '\n').split('\n')) {
    if (/^\s{0,3}\x60{3}/.test(line)) {
      finishParagraph();
      list = null;
      if (codeLines) finishCode();
      else codeLines = [];
      continue;
    }
    if (codeLines) {
      codeLines.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)/);
    const bullet = line.match(/^\s*[-*]\s+(.+)/);
    if (heading) {
      finishParagraph();
      list = null;
      const node = document.createElement(heading[1].length === 3 ? 'h3' : 'h2');
      inline(heading[2], node);
      content.append(node);
    } else if (bullet) {
      finishParagraph();
      if (!list) {
        list = document.createElement('ul');
        content.append(list);
      }
      const node = document.createElement('li');
      inline(bullet[1], node);
      list.append(node);
    } else if (!line.trim()) {
      finishParagraph();
      list = null;
    } else {
      list = null;
      paragraph.push(line.trim());
    }
  }

  finishParagraph();
  if (codeLines) finishCode();
  target.replaceChildren(content);
}

