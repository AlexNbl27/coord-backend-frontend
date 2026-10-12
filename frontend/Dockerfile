# =============================================================================
# Dockerfile pour le Frontend (Vite + Vue 3 + TypeScript)
# Mode : Développement (avec hot-reload)
# =============================================================================

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de configuration
COPY package*.json ./
COPY vite.config.ts ./
COPY tailwind.config.js ./
COPY tsconfig.json ./

# Installer les dépendances
RUN npm ci

# Copier le reste des sources
COPY src ./src
COPY public ./public
COPY index.html .

# Run stage (développement)
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=development

# Copier les dépendances et les sources depuis le builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/vite.config.ts ./
COPY --from=builder /app/tailwind.config.js ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/index.html .

# Exposer le port Vite
EXPOSE 5173

# Lancer le serveur de développement Vite
CMD ["npm", "run", "dev"]
