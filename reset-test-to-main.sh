#!/bin/bash

set -e

echo "======================================"
echo " Reset TEST branch to match MAIN"
echo "======================================"
echo ""

echo "Fetching latest branches from origin..."
git fetch origin

echo ""
echo "Checking current branch..."
current_branch=$(git branch --show-current)
echo "Current branch: $current_branch"

echo ""
echo "Checking for uncommitted changes..."
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: You have uncommitted local changes."
  echo ""
  git status
  echo ""
  echo "Please commit, stash, or discard them first."
  exit 1
fi

echo ""
echo "Switching to test branch..."
git checkout test

echo ""
echo "Resetting local test branch to origin/main..."
git reset --hard origin/main

echo ""
echo "Pushing reset test branch to origin/test..."
git push --force-with-lease origin test

echo ""
echo "======================================"
echo " DONE"
echo " test branch is now synced with main"
echo "======================================"
echo ""

git log --oneline --decorate -5
