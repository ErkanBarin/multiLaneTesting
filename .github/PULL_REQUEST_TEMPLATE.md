# Pull Request

## Description

<!-- What does this change do and why? -->

## Checklist

- [ ] `npm run validate` passes (typecheck, lint, unit tests, policy gates)
- [ ] `npm run dogfood` passes
- [ ] No runtime AI dependencies introduced (verified by `npm run check:no-runtime-ai`)
- [ ] No internal hostnames or credentials in committed files
- [ ] Documentation updated to match any behavior change
- [ ] Tests added or updated to cover the changed behavior
- [ ] `package-lock.json` changes are intentional and explained above
      (if the lockfile changed unintentionally, revert it before merging)
