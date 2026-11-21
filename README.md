# Swastika Sinha’s portfolio

Run `npm start` with Node.js 24 or newer, then open http://127.0.0.1:4173/. The site requires no package installation.

The server listens on local loopback. Dashboard notes and sketches are saved in the current browser.

The **Import Check** prototype uses the local JSON API and synthetic contracts. The case study credits the DataHub hackathon project that inspired it.

## Deploy on Vercel

Import this repository using the repository root as the Root Directory. The committed `vercel.json` selects the **Other** preset and runs `npm run build` to generate `dist`. The public pages and error pages are static. The Import Check API uses its own Vercel Function.

With the repository linked to Vercel, push to the production branch `main`. Open the new deployment in Vercel and use its **Visit** link.

## Publish a blog post

Add one Markdown file to `posts/` and commit it to Git. See [the post format](posts/README.md). The public Blog loads on the local preview and on Vercel without an account.
