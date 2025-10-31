#!/usr/bin/env bash
set -e
npm ci
npx prisma generate
npm run build