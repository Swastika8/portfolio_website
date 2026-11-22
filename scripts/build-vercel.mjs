import { cp, mkdir, realpath, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderErrorPage } from '../error-pages.mjs';
import { listPosts, summarizePosts } from './blog-content.mjs';

const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
const posts = await listPosts();
const output = join(root, 'dist');
const existingOutput = await realpath(output).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
});
if (existingOutput && existingOutput !== output) throw new Error('dist must be a directory inside this checkout.');
await rm(output, { recursive: true, force: true });
await mkdir(output);

const publicFiles = [
  'index.html', 'about.html', 'blog.html', 'post.html', 'skills.html',
  'styles.css', 'notebook.css', 'notebook.js', 'about-desk.css', 'about-desk.js',
  'blog.js', 'journal-text.js', 'error.css', 'error-pages.mjs', 'portfolio-worker.js', 'register-offline.js',
  'assets', 'projects', 'play',
];
await Promise.all(publicFiles.map((file) => cp(join(root, file), join(output, file), { recursive: true })));

const blogData = join(output, 'blog-data');
await mkdir(blogData);
await Promise.all(posts.map((post) => writeFile(join(blogData, `${post.id}.json`), JSON.stringify({ post }))));
await writeFile(join(blogData, 'posts.json'), JSON.stringify({ posts: summarizePosts(posts) }));

await Promise.all([404, 500, 503, 504].map((status) => writeFile(join(output, `${status}.html`), renderErrorPage(status))));
console.log('Built the public Vercel portfolio in dist.');
