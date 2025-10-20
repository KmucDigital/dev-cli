function generateDockerfile(answers) {
  const { projectType, port } = answers;

  switch (projectType) {
    case 'express':
      return generateExpressDockerfile(port);
    case 'nextjs':
      return generateNextJsDockerfile(port);
    case 'react-vite':
      return generateReactViteDockerfile(port);
    case 'node-basic':
      return generateNodeBasicDockerfile(port);
    case 'static':
      return generateStaticDockerfile();
    default:
      return generateNodeBasicDockerfile(port);
  }
}

function generateExpressDockerfile(port) {
  return `# Node.js Express Dockerfile
FROM node:20-alpine AS base

# Installiere dependencies für native modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Dependencies installieren
COPY package*.json ./
RUN npm ci --only=production

# App-Code kopieren
COPY . .

# Non-root user erstellen
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

# Permissions setzen
RUN chown -R expressjs:nodejs /app

USER expressjs

EXPOSE ${port}

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \\
  CMD node -e "require('http').get('http://localhost:${port}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "server.js"]
`;
}

function generateNextJsDockerfile(port) {
  return `# Next.js Dockerfile - Multi-stage Build
FROM node:20-alpine AS base

# Dependencies installieren
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package*.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE ${port}

ENV PORT ${port}
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
`;
}

function generateReactViteDockerfile(port) {
  return `# React Vite Dockerfile - Multi-stage Build
FROM node:20-alpine AS builder

WORKDIR /app

# Dependencies installieren
COPY package*.json ./
RUN npm ci

# Build
COPY . .
RUN npm run build

# Nginx für Serving
FROM nginx:alpine

# Nginx config kopieren
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config (nginx always uses port 80 internally)
RUN echo 'server { \\
    listen 80; \\
    location / { \\
        root /usr/share/nginx/html; \\
        index index.html index.htm; \\
        try_files \\$uri \\$uri/ /index.html; \\
    } \\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;
}

function generateNodeBasicDockerfile(port) {
  return `# Node.js Basis Dockerfile
FROM node:20-alpine

WORKDIR /app

# Dependencies installieren
COPY package*.json ./
RUN npm ci --only=production

# App-Code kopieren
COPY . .

# Non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeapp

RUN chown -R nodeapp:nodejs /app

USER nodeapp

EXPOSE ${port}

CMD ["node", "index.js"]
`;
}

function generateStaticDockerfile() {
  return `# Static Website Dockerfile
FROM nginx:alpine

# Static files kopieren
COPY . /usr/share/nginx/html

# Default nginx config erstellen
RUN echo 'server {' > /etc/nginx/conf.d/default.conf && \\
    echo '    listen 80;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    location / {' >> /etc/nginx/conf.d/default.conf && \\
    echo '        root /usr/share/nginx/html;' >> /etc/nginx/conf.d/default.conf && \\
    echo '        index index.html index.htm;' >> /etc/nginx/conf.d/default.conf && \\
    echo '        try_files $uri $uri/ /index.html;' >> /etc/nginx/conf.d/default.conf && \\
    echo '    }' >> /etc/nginx/conf.d/default.conf && \\
    echo '}' >> /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
`;
}

module.exports = { generateDockerfile };
