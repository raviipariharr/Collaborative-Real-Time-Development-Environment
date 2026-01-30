FROM node:18-alpine

WORKDIR /app

# Install OpenSSL (required for Prisma)
RUN apk add --no-cache openssl libc6-compat

# Copy package files and Prisma schema BEFORE npm install
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev dependencies for build)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies for smaller image (optional)
RUN npm prune --production

# Expose app port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run migrations and start the app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]