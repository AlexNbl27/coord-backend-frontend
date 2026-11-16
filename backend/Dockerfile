FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && chown -R node:node /app

COPY --chown=node:node src ./src

USER node

EXPOSE 3000
ENV PORT=3000

CMD ["node", "--import", "./src/tracing.js", "src/server.js"]
