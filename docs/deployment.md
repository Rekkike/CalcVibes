# Deployment (GitHub Pages)

This note records the pre-1.0 walkthrough deployment of the web application.

- Live URL: https://rekkike.github.io/CalcVibes/
- Pipeline: .github/workflows/deploy-pages.yml (GitHub Actions)
- Trigger: every push to main (plus manual dispatch)
- Steps: npm ci, typecheck, the web test battery (vitest), vite build with base /CalcVibes/, upload-pages-artifact, deploy-pages
- Pages source: "GitHub Actions" (set once in repository Settings > Pages, 2026-10-08)
- Scope of record: client-side application only; no user project data is hosted. Desktop packaging (Tauri) remains the v1.0 goal per docs/SPECIFICATION.md.

Related specification change: the section 2 decision "GitHub Pages deployment is out of scope" is overturned for the pre-1.0 walkthrough period; the spec amendment is graded with the next specification push.
