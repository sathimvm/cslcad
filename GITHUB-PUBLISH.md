Publishing this project to GitHub Pages

1) Create a new repository on GitHub (do not initialize with README/license).

2) Locally, from the project root, run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

3) The workflow `.github/workflows/deploy-pages.yml` will run on push and publish content to the `gh-pages` branch.

4) In GitHub repository Settings → Pages, set the source to `gh-pages` branch and root `/`.
   The site will be available at `https://USERNAME.github.io/REPO/` within a few minutes.

Notes
- If you prefer to serve from the `main` branch directly, you can enable GitHub Pages from the branch without the workflow.
- The server upload feature requires a backend — either run the included `server.js` on a Node host or point `?apiBase=` to your backend. Without a server the app falls back to browser storage (IndexedDB).
