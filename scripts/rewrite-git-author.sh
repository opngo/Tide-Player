#!/usr/bin/env bash
set -euo pipefail

# Rewrites all Git history commits from Rawclaw (or any previous author) to Opngo
NEW_NAME="Opngo"
NEW_EMAIL="Opngo@users.noreply.github.com"

git config user.name "$NEW_NAME"
git config user.email "$NEW_EMAIL"

FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f --env-filter '
  export GIT_AUTHOR_NAME="Opngo"
  export GIT_AUTHOR_EMAIL="Opngo@users.noreply.github.com"
  export GIT_COMMITTER_NAME="Opngo"
  export GIT_COMMITTER_EMAIL="Opngo@users.noreply.github.com"
' --tag-name-filter cat -- --branches --tags

echo "Git history successfully rewritten to author/committer: $NEW_NAME <$NEW_EMAIL>"
git log --format="%h | Author: %an <%ae> | Committer: %cn <%ce> | %s" -n 10
