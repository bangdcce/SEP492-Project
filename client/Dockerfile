FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

ARG VITE_API_URL=https://localhost:3000
ARG VITE_SUPABASE_URL=https://your-project-ref.supabase.co
ARG VITE_SUPABASE_ANON_KEY=replace-with-anon-key
ARG VITE_APP_NAME=InterDev
ARG VITE_APP_VERSION=1.0.0
ARG VITE_ENV=production
ARG VITE_RECAPTCHA_SITE_KEY=

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_APP_NAME=$VITE_APP_NAME
ENV VITE_APP_VERSION=$VITE_APP_VERSION
ENV VITE_ENV=$VITE_ENV
ENV VITE_RECAPTCHA_SITE_KEY=$VITE_RECAPTCHA_SITE_KEY

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
