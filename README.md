# Swastika Sinha’s portfolio

Run `npm start` with Node.js 24 or newer, then open http://127.0.0.1:4173/. The site requires no package installation.

Open **Blog**, then **Writing studio**. Choose a studio password on your first visit. Save drafts privately or publish to make a post visible to blog readers on this local server. You can revise a published post as a draft and publish the new version when it is ready.

The server listens on local loopback. Posts and studio credentials are persisted in `.portfolio-data/portfolio.sqlite`. Dashboard notes and sketches are saved in the current browser.

The **Import Check** prototype uses the local JSON API and synthetic contracts. The case study credits the DataHub hackathon project that inspired it.

## Deploy on Vercel

Import this repository using the repository root as the Root Directory. The committed `vercel.json` selects the **Other** preset and runs `npm run build` to generate `dist`. The public pages and error pages are static. The Import Check API uses its own Vercel Function.

The writing studio runs locally with `npm start`. To publish its current public posts on Vercel, finish publishing in the studio, run `npm run export:blog`, review `published-posts.json`, and commit and push that file. The export reads the published versions of posts. A fresh build with no export shows the blog's empty state.
