FROM node:18-alpine as base
RUN npm i pnpm -g
WORKDIR /app

COPY ./package.json ./
COPY ./pnpm-lock.yaml ./
COPY ./.npmrc ./

RUN pnpm install

COPY ./tsconfig.json ./
COPY ./src ./src
COPY ./node_modules ./node_modules

RUN pnpm build

FROM node:18-alpine as prod
RUN npm i pnpm -g
WORKDIR /app
ENV NODE_ENV production

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./
COPY --from=base /app/.env ./
COPY --from=base /app/dist ./dist

EXPOSE 80

CMD ["pnpm", "run", "start"]
