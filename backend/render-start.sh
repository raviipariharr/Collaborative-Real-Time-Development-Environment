#!/usr/bin/env bash
set -e

echo "🔧 Starting application..."

# Check if dist folder exists
if [ ! -d "dist" ]; then
    echo "❌ dist folder not found! Running build..."
    npm run build
fi

# Check if Prisma Client is generated
echo "🔍 Checking Prisma Client..."
if [ ! -d "node_modules/.prisma" ]; then
    echo "⚙️  Generating Prisma Client..."
    npx prisma generate
fi

# Run migrations
echo "📊 Running database migrations..."
npx prisma migrate deploy

# Start the application
echo "🚀 Starting Node.js server..."
node dist/app.js