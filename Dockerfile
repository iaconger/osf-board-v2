FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
# Render injects PORT at runtime; the server reads process.env.PORT.
CMD ["node", "server.js"]
