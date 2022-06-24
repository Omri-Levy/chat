FROM node:18-alpine
ENV NODE_ENV production

WORKDIR /app

COPY ../package*.json ./
COPY ../.env ./

RUN npm ci

COPY ../shell-js.mjs ./
COPY ../src ./src

EXPOSE 80

CMD ["npm", "run", "start"]
