FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

ARG VITE_API_URL=http://localhost:3000
ARG VITE_ENV=production
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ENV=$VITE_ENV

RUN yarn build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
