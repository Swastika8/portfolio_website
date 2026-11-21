import { readFile, readdir } from 'node:fs/promises';

const directory = new URL('../posts/', import.meta.url);
const postId = /^(\d{4}-\d{2}-\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function readPost(id) {
  const match = postId.exec(id ?? '');
  if (!match) return null;
  let markdown;
  try {
    markdown = await readFile(new URL(`${id}.md`, directory), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }

  const date = new Date(`${match[1]}T00:00:00.000Z`);
  const heading = /^# +([^\n]+)\n([\s\S]*)$/.exec(markdown.replaceAll('\r\n', '\n').trim());
  if (!heading?.[1].trim() || !heading[2].trim() || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== match[1]) {
    throw new Error(`Invalid post ${id}.md. Check the date, title and body.`);
  }
  return { id, title: heading[1].trim(), body: heading[2].trim(), published_at: date.toISOString() };
}

export async function listPosts() {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
    .map((entry) => entry.name.slice(0, -3)).sort().reverse();
  for (const id of names) {
    if (!postId.test(id)) throw new Error(`Expected YYYY-MM-DD-title.md for ${id}.md.`);
  }
  return (await Promise.all(names.map(readPost))).filter(Boolean);
}

export function summarizePosts(posts) {
  return posts.map(({ id, title, body, published_at }) => ({ id, title, excerpt: body.slice(0, 240), published_at }));
}
