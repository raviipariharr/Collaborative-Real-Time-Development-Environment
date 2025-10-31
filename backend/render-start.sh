#!/usr/bin/env bash
set -e
chmod +x node_modules/.bin/prisma || true
npx prisma migrate deploy
node dist/app.js
