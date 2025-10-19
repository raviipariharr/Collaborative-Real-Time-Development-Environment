# Use official Node.js Alpine image
FROM node:18-alpine

WORKDIR /app

# Install OpenSSL (required for Prisma)
RUN apk add --no-cache openssl

# Copy package files and Prisma schema first
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy the rest of your app
COPY . .

# Fix permission issue for Prisma CLI binary
RUN chmod +x ./node_modules/.bin/prisma

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Expose app port
EXPOSE 3001

# Run migrations and start the app
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
