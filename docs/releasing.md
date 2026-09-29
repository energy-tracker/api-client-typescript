# Releases

Package: `@energy-tracker/api-client`. Repository: `energy-tracker/api-client-typescript`.

## One-time setup

1. Create the public GitHub repository and push this checkout's `main` branch.
2. Ensure the publishing npm account has access to the `energy-tracker` npm scope.
   A GitHub organization does not automatically reserve the corresponding npm scope.
3. For the first tag release, add a temporary GitHub Actions secret `NPM_TOKEN`
   containing a granular npm token allowed to create/publish the scoped package
   without interactive 2FA. Push `v1.0.0` on the reviewed `main` commit using the
   tag commands below. The workflow publishes the package and creates its GitHub release.
4. After that initial publication, in the npm package's settings add a GitHub Actions trusted publisher:
   organization `energy-tracker`, repository `api-client-typescript`, workflow
   `release.yml`, no environment name. Allow direct `npm publish`.
5. Remove the GitHub `NPM_TOKEN` secret and revoke that bootstrap token. Further
   releases authenticate through OIDC.

The [npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/)
describes this configuration. Subsequent releases use OIDC with provenance and
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
