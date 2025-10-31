#!/usr/bin/env bash
set -e
npm ci
chmod +x node_modules/.bin/prisma || true
npx prisma generate
npm run build
