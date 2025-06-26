# --- Stage 1: Build ---
# Use an official Node.js image with pnpm pre-installed
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy dependency definition files
COPY package.json pnpm-lock.yaml ./

# Install dependencies for production first, then all dependencies
# This leverages Docker's layer caching.
RUN pnpm fetch --prod
RUN pnpm install -r --prod
RUN pnpm install -r

# Copy the rest of the application source code
COPY . .

# Build the TypeScript project
RUN pnpm run build

# --- Stage 2: Production ---
# Use a lightweight Node.js image
FROM node:22-alpine AS production

# Set working directory
WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy dependency definition files
COPY package.json pnpm-lock.yaml ./

# Install ONLY production dependencies using pnpm
RUN npm install -g pnpm && pnpm install --prod

# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist

# Expose the port the app runs on (defaulting to 8080)
EXPOSE 8080

# The command to run the application
# It uses the 'start' script from package.json: "node dist/server.js"
CMD ["pnpm", "start"] 