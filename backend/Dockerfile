FROM node:18-alpine AS builder

WORKDIR /app

# Copy root workspace config
COPY package.json package-lock.json* ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# Install all workspace dependencies
RUN npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts

# Copy backend source and build
COPY backend/ backend/
RUN npm run build -w backend

# --- Production stage ---
FROM node:18-alpine

WORKDIR /app

# bcrypt requires native compilation tools
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
COPY backend/package.json backend/

RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY --from=builder /app/backend/dist backend/dist

# Copy keys directory if it exists (ignore if missing)
RUN mkdir -p backend/keys
COPY backend/package.json backend/keys* backend/keys/

EXPOSE 3000

CMD ["node", "backend/dist/index.js"]
