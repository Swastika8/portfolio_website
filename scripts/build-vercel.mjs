import { cp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderErrorPage } from '../error-pages.mjs';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const output = join(root, 'dist');
const existingOutput = await realpath(output).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
});
if (existingOutput && existingOutput !== output) throw new Error('dist must be a directory inside this checkout.');
await rm(output, { recursive: true, force: true });
await mkdir(output);

const publicFiles = [
  'index.html', 'about.html', 'blog.html', 'post.html',
  'styles.css', 'notebook.css', 'notebook.js', 'about-desk.css', 'about-desk.js',
  'blog.js', 'journal-text.js', 'error.css', 'error-pages.mjs', 'portfolio-worker.js', 'register-offline.js',
  'assets', 'projects',
];
await Promise.all(publicFiles.map((file) => cp(join(root, file), join(output, file), { recursive: true })));

const exported = await readFile(join(root, 'published-posts.json'), 'utf8').catch((error) => {
  if (error.code === 'ENOENT') return '[]';
  throw error;
});
const posts = JSON.parse(exported).map(({ id, title, body, published_at }) => {
  if (typeof id !== 'string' || !/^[a-f0-9]{20}$/.test(id) || typeof title !== 'string' || typeof body !== 'string' || !Number.isFinite(Date.parse(published_at))) {
    throw new Error('published-posts.json contains an invalid public post.');
  }
  return { id, title, body, published_at, excerpt: body.slice(0, 240) };
});

const blogData = join(output, 'blog-data');
await mkdir(blogData);
await Promise.all(posts.map(({ id, title, body, published_at }) =>
  writeFile(join(blogData, `${id}.json`), JSON.stringify({ post: { id, title, body, published_at } }))));
await writeFile(join(blogData, 'posts.json'), JSON.stringify({ posts: posts.map(({ id, title, excerpt, published_at }) => ({ id, title, excerpt, published_at })) }));

for (const filename of ['blog.html', 'post.html']) {
  const path = join(output, filename);
  const page = await readFile(path, 'utf8');
  await writeFile(path, page.replace('<body class="journal-page">', '<body class="journal-page" data-static-blog>')
    .replace(/\s*<aside class="journal-margin" data-local-studio>[\s\S]*?<\/aside>/, ''));
}

await Promise.all([404, 500, 503, 504].map((status) => writeFile(join(output, `${status}.html`), renderErrorPage(status))));
console.log('Built the public Vercel portfolio in dist.');
