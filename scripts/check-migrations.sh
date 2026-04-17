#!/usr/bin/env bash
# Pre-commit hook: ensures Drizzle migrations are generated when schema changes.
#
# How it works:
#   1. Checks if any staged files are in packages/db/src/schema/
#   2. If yes, checks if migration files (SQL, snapshots, journal) are also staged
#   3. If schema changed but no migration files are staged, blocks the commit
#
# This prevents the #1 recurring bug: schema/DB mismatch on deploy.

set -euo pipefail

SCHEMA_DIR="packages/db/src/schema"
MIGRATION_DIR="packages/db/drizzle"

# Get staged files (added, modified, renamed)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)

# Check if any schema files are staged
SCHEMA_CHANGED=false
for file in $STAGED_FILES; do
  if [[ "$file" == ${SCHEMA_DIR}/* ]]; then
    SCHEMA_CHANGED=true
    break
  fi
done

# If no schema files changed, nothing to check
if [ "$SCHEMA_CHANGED" = false ]; then
  exit 0
fi

# Schema changed — check if migration files are also staged
MIGRATION_STAGED=false
for file in $STAGED_FILES; do
  # Match SQL files or meta files (snapshots, journal)
  if [[ "$file" == ${MIGRATION_DIR}/*.sql ]] || [[ "$file" == ${MIGRATION_DIR}/meta/* ]]; then
    MIGRATION_STAGED=true
    break
  fi
done

if [ "$MIGRATION_STAGED" = false ]; then
  echo ""
  echo "========================================================"
  echo "  BLOQUEADO: Schema alterado sem migration gerada"
  echo "========================================================"
  echo ""
  echo "  Arquivos de schema modificados:"
  for file in $STAGED_FILES; do
    if [[ "$file" == ${SCHEMA_DIR}/* ]]; then
      echo "    - $file"
    fi
  done
  echo ""
  echo "  Nenhum arquivo de migration foi incluido no commit."
  echo ""
  echo "  Fix:"
  echo "    1. pnpm db:generate"
  echo "    2. git add packages/db/drizzle/"
  echo "    3. git commit novamente"
  echo ""
  echo "  Para ignorar (emergencia): git commit --no-verify"
  echo "========================================================"
  echo ""
  exit 1
fi

echo "[check-migrations] Schema + migrations em sync. OK."
