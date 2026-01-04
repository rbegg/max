# --- STAGE 1: The Base Stage ---
# This stage is a common foundation for both dev and prod.
FROM node:20-alpine AS base

# Create the directory and set ownership to the 'node' user
RUN mkdir -p /proxy && chown -R node:node /proxy

WORKDIR /proxy

# Switch to the non-root 'node' user
USER node

# Copy package.json and package-lock.json first for layer caching.
COPY --chown=node:node package*.json ./

# Install all dependencies.
RUN npm install

# Copy the rest of your application's source code.
COPY --chown=node:node . .


# --- STAGE 2: Builder ---
# This runs 'vite build' to create the /proxy/dist folder
FROM base AS builder

# Run the build script to create the 'dist' directory.
RUN npm run build

# --- STAGE 3: TARGET: Development ---
FROM nginx:1.27-alpine AS dev

# Dev an prod use the same Nginx configuration with a sepcific .template file (refer to docker-compose.*.yaml)
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built assets from the 'builder' stage.
COPY --from=builder /proxy/dist /usr/share/nginx/html

EXPOSE ${PROXY_HTTP_PORT:-8080}
EXPOSE ${PROXY_HTTPS_PORT:-8443}



# --- STAGE 3: TARGET: Production (default) ---
# Final production stage serves the built assets with Nginx.
FROM nginx:1.27-alpine AS prod

# Dev an prod use the same Nginx configuration with a sepcific .template file (refer to docker-compose.*.yaml)
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built assets from the 'builder' stage.
COPY --from=builder /proxy/dist /usr/share/nginx/html

EXPOSE ${PROXY_HTTP_PORT:-80}
EXPOSE ${PROXY_HTTPS_PORT:-443}
