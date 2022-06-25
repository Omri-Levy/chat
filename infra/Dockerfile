FROM node:18-alpine
ENV NODE_ENV production
RUN npm i pnpm -g

WORKDIR /app

COPY ../package.json ./
COPY ../pnpm-lock.yaml ./
COPY ../.npmrc ./

RUN pnpm install

COPY ../.env ./
COPY ../src ./src

RUN pnpm build

EXPOSE 80

CMD ["pnpm", "run", "start"]
