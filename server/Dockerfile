FROM node:22-bookworm-slim AS deps

WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM deps AS build

COPY . .
RUN yarn build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true && yarn cache clean

COPY --from=build /app/dist ./dist
COPY template.html ./template.html

RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "dist/main"]
