#!/bin/bash
echo "🧹 Cleaning Metro cache and node_modules..."
watchman watch-del-all 2>/dev/null || true
rm -rf node_modules
rm -rf .expo
rm -rf android/.gradle
rm -rf android/app/build
echo "📦 Reinstalling dependencies..."
pnpm install
echo "✅ Done! Now run: npx expo start -c"
