import { formatDate, portfolioRequest, renderJournalText } from './journal-text.js';

const status = document.querySelector('#journal-status');
const listing = document.querySelector('#journal-posts');

function postEntry(post) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  const title = document.createElement('h2');
  const date = document.createElement('time');
  const excerpt = document.createElement('p');
  link.href = 'post.html?id=' + encodeURIComponent(post.id);
  title.textContent = post.title;
  date.dateTime = post.published_at;
  date.textContent = formatDate(post.published_at);
  excerpt.textContent = post.excerpt.replace(/^[#\s]+|\x60+/g, '').trim() + (post.excerpt.length === 240 ? '…' : '');
  link.append(title, date, excerpt);
  item.append(link);
  return item;
}

async function openJournal() {
  try {
    if (listing) {
      const { posts } = await portfolioRequest('/blog-data/posts.json');
      listing.replaceChildren(...posts.map(postEntry));
      status.textContent = posts.length ? '' : 'No posts yet. New entries will appear here when they’re published.';
      status.hidden = posts.length > 0;
      return;
    }
    const id = new URLSearchParams(location.search).get('id');
    if (!id || !/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('This post is unavailable.');
    const { post } = await portfolioRequest('/blog-data/' + id + '.json');
    document.title = post.title + ' — Swastika Sinha';
    document.querySelector('#post-title').textContent = post.title;
    const date = document.querySelector('#post-date');
    date.dateTime = post.published_at;
    date.textContent = formatDate(post.published_at);
    date.hidden = false;
    renderJournalText(post.body, document.querySelector('#post-body'));
    status.hidden = true;
  } catch (error) {
    status.hidden = false;
    status.textContent = error.message;
  }
}

openJournal();

