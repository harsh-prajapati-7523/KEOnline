#!/bin/bash

set -e

echo "Checking current Git status..."
git status

echo ""
echo "Fetching latest branches..."
git fetch origin

echo ""
echo "Switching to test branch..."
git checkout test

echo ""
echo "Pulling latest test branch..."
git pull --ff-only origin test

echo ""
echo "Current changes:"
git status

echo ""
read -p "Enter commit message: " commit_message

if [ -z "$commit_message" ]; then
  echo "Commit message cannot be empty."
  exit 1
fi

echo ""
echo "Adding all changes..."
git add .

echo ""
echo "Committing changes..."
git commit -m "$commit_message"

echo ""
echo "Pushing to origin/test..."
git push origin test

echo ""
echo "Done. Changes pushed to test branch."
