#!/bin/bash

set -e

echo "Checking for uncommitted local changes..."
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "You have uncommitted changes."
  echo "Commit or stash them before merging test into main."
  git status
  exit 1
fi

echo ""
echo "Fetching latest branches..."
git fetch origin

echo ""
echo "Switching to test branch..."
git checkout test

echo ""
echo "Updating test branch..."
git pull --ff-only origin test

echo ""
echo "Switching to main branch..."
git checkout main

echo ""
echo "Updating main branch..."
git pull --ff-only origin main

echo ""
echo "Merging origin/test into main..."
git merge origin/test

echo ""
echo "Pushing main to origin/main..."
git push origin main

echo ""
echo "Done. test branch has been merged into main and pushed."
