# --- STAGE 1: The Base Stage ---
# This stage is a common foundation for both dev and prod.
FROM node:20-alpine AS base

WORKDIR /proxy

# Copy package.json and package-lock.json first for layer caching.
COPY package*.json ./

# Install all dependencies.
RUN npm install

# Copy the rest of your application's source code.
COPY . .


# --- TARGET: Development ---
# This target builds a development image. It uses Vite's dev server for hot-reloading.
FROM base AS dev

# Expose the default Vite development port.
EXPOSE 5173

# The command to start the Vite development server.
# The '--host' flag is crucial to expose the server outside the container.
CMD [ "npm", "run", "dev", "--", "--host" ]


# --- TARGET: Production (default) ---
# This target builds the final, optimized production image.
FROM base AS builder

# Run the build script to create the 'dist' directory.
RUN npm run build

# ---
# Final production stage serves the built assets with Nginx.
FROM nginx:1.27-alpine AS prod

# Copy the production Nginx configuration.
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built assets from the 'builder' stage.
COPY --from=builder /proxy/dist /usr/share/nginx/html

# Expose port 80 for the Nginx server.
EXPOSE 80

# Expose port 443 for the Nginx server (for HTTPS traffic).
EXPOSE 443