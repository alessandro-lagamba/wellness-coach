# Dockerfile per Railway deployment
FROM node:20-alpine AS builder

WORKDIR /app

# Copia package files
COPY package*.json ./
COPY tsconfig.json ./

# Installa dipendenze
RUN npm install

# Copia sorgenti
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copia package files
COPY package*.json ./

# Installa solo production dependencies
RUN npm install --only=production

# Copia built files
COPY --from=builder /app/dist ./dist

# Esponi porta (Railway userà PORT env var automaticamente)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server (Railway userà PORT env var)
CMD ["node", "dist/server.js"]

