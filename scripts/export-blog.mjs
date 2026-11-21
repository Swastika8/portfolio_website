import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = resolve(process.env.PORTFOLIO_DATA_DIR || join(root, '.portfolio-data'));
const database = new DatabaseSync(join(directory, 'portfolio.sqlite'), { readOnly: true });
let posts;
try {
  posts = database.prepare(`
    SELECT id, published_title AS title, published_body AS body, published_at
    FROM posts WHERE published_at IS NOT NULL
    ORDER BY published_at DESC, id
  `).all();
} finally {
  database.close();
}
await writeFile(join(root, 'published-posts.json'), JSON.stringify(posts, null, 2) + '\n');
console.log(`Exported ${posts.length} published posts to published-posts.json.`);
