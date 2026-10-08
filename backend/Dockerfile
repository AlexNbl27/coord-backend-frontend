FROM node:22-alpine

WORKDIR /app

# Installation des dépendances
COPY package*.json ./
RUN npm install --omit=dev

# Copie des sources
COPY src ./src

EXPOSE 3000

ENV PORT=3000

CMD ["node", "src/server.js"]
