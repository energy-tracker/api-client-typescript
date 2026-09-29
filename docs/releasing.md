# Releases

Package: `@energy-tracker/api-client`. Repository: `energy-tracker/api-client-typescript`.

## Publishing authentication

Releases use npm Trusted Publishing (OIDC). No `NPM_TOKEN` secret is needed.
The npm package's trusted publisher must match:

- Provider: GitHub Actions
- Organization: `energy-tracker`
- Repository: `api-client-typescript`
- Workflow: `release.yml`
- Environment: none
- Allowed action: direct `npm publish`

When setting up a new package, publish its first version using an authenticated
npm account with 2FA before configuring Trusted Publishing. npm requires the
package to exist before a trusted publisher can be added.

The [npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/)
describes this configuration. Releases use OIDC with provenance and
need no long-lived npm token in GitHub secrets. The repository must be public for
public npm provenance. The workflow uses GitHub-hosted Ubuntu 24.04 and Node 24.

## Version and tag

```sh
npm version 1.1.0 --no-git-tag-version
npm run check
```

Commit both `package.json` and `package-lock.json`, review and merge to `main`.
Create the tag on the merged commit, including after a squash merge:

```sh
git switch main
git pull --ff-only
git tag -a v1.1.0 -m 'Release 1.1.0'
git push origin v1.1.0
```

The release workflow checks that the tag exactly matches the package and lockfile
versions, and that its commit belongs to `main`. It runs the complete CI matrix,
publishes to npm and then creates a GitHub release with generated notes.
Stable versions use npm's `latest` tag; prereleases such as `1.1.0-rc.1` use `next`
and are marked as GitHub prereleases. Versions are explicit; CI does not bump them.

If npm publication succeeds but GitHub release creation fails, rerun only the
failed job. Published npm versions are immutable; do not move a released tag.
