# Publishing to npm

This package is published as `@arpitbbhayani/present` on npm.

## Semantic versioning

Versions follow `MAJOR.MINOR.PATCH`:

- `PATCH` — backwards-compatible bug fixes
- `MINOR` — new backwards-compatible functionality
- `MAJOR` — breaking changes (CLI flags removed/renamed, output format changed, Node version floor raised)

Current version is in `package.json` under the `"version"` field.

## Pre-publish checklist

- All changes are committed and the working tree is clean
- `npm run build` succeeds without errors
- The `dist/` directory reflects the latest source
- `package.json` has `"files": ["dist"]` so only compiled output is shipped

## Updating the version

Edit `package.json` manually or use npm's version command, which also commits and tags:

```bash
# patch: 1.0.0 → 1.0.1
npm version patch

# minor: 1.0.0 → 1.1.0
npm version minor

# major: 1.0.0 → 2.0.0
npm version major
```

`npm version` updates `package.json`, creates a git commit (`v1.2.3`), and tags it. Push both the commit and the tag:

```bash
git push origin master --tags
```

## Building and publishing

```bash
npm run build
npm publish --access public
```

`--access public` is required for scoped packages on the first publish. Subsequent publishes do not need it, but it is safe to include every time.

## Verifying the release

```bash
npm info @arpitbbhayani/present
```

Check that the `version` field and `dist-tags.latest` match what you just published.

## Installing the published package

```bash
npm install -g @arpitbbhayani/present
```
