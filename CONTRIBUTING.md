# Contributing to FocusForge

Thank you for your interest in contributing to FocusForge! Please follow these guidelines to keep the codebase clean, stable, and tested.

---

## 1. Branching Strategy

- `main` is always releasable and protected.
- Feature branches should branch off `main` using descriptive prefixes:
  - `feature/<short-description>`: New functionality
  - `fix/<issue-description>`: Bug fixes
  - `refactor/<scope>`: Code cleanup without functional change
  - `docs/<topic>`: Documentation updates

---

## 2. Commit Message Conventions

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short summary>

[optional body]
```

### Allowed Types:
- `feat`: A new feature for the user
- `fix`: A bug fix
- `docs`: Documentation changes
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests or correcting existing tests
- `chore`: Build process, dependency updates, or auxiliary tools

### Examples:
- `feat(auth): implement silent token refresh rotation with reuse detection`
- `fix(tasks): resolve due date time boundary parsing in local adapter`
- `test(e2e): add axe-core automated accessibility audit`

---

## 3. Pull Request Checklist

Before submitting a Pull Request, ensure all quality gates pass:
1. `npm run lint` passes across all workspaces with 0 warnings.
2. `npm run typecheck` passes with zero TypeScript errors.
3. `npm test` passes 100% of unit and API integration tests.
4. `npm --prefix apps/web run test:e2e` passes all Playwright browser tests.
5. New features include corresponding tests.
