import { portfolioRequest } from '../journal-text.js';

const form = document.querySelector('#compare-form');
const button = form.querySelector('button[type="submit"]');
const output = document.querySelector('#schema-results');

function resultText(text) {
  const paragraph = document.createElement('p');
  paragraph.textContent = text;
  output.replaceChildren(paragraph);
}

function group(title, descriptions) {
  const section = document.createElement('section');
  const heading = document.createElement('h3');
  const list = document.createElement('ul');
  heading.textContent = title;
  for (const description of descriptions) {
    const item = document.createElement('li');
    item.textContent = description;
    list.append(item);
  }
  section.append(heading, list);
  return section;
}

function parseContract(id, label) {
  try {
    return JSON.parse(document.querySelector(id).value);
  } catch {
    throw new Error(label + ' needs valid JSON.');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (button.disabled) return;
  button.disabled = true;
  try {
    const expected = parseContract('#expected-contract', 'Expected contract');
    const incoming = parseContract('#incoming-contract', 'Incoming contract');
    const { missing, added, changed } = await portfolioRequest('/api/schema-check', { expected, incoming });
    const total = missing.length + added.length + changed.length;
    if (!total) {
      resultText('The two contracts match.');
      return;
    }

    resultText(total + (total === 1 ? ' change found.' : ' changes found.'));
    if (missing.length) output.append(group('Missing fields', missing.map(({ field, type }) => field + ' (' + type + ')')));
    if (added.length) output.append(group('New fields', added.map(({ field, type }) => field + ' (' + type + ')')));
    if (changed.length) output.append(group('Changed types', changed.map(({ field, expected, incoming }) => field + ' changed from ' + expected + ' to ' + incoming)));
  } catch (error) {
    resultText(error.message);
  } finally {
    button.disabled = false;
  }
});

