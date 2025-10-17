function generateDockerCompose(answers) {
  const { projectName, projectType, port, needsDatabase, database, needsReverseProxy } = answers;

  // Keine version mehr - das ist obsolete seit Docker Compose v2
  let compose = `services:
  app:
    build: .
    container_name: ${projectName}-app
    restart: unless-stopped
`;

  // Port Mapping
  if (needsReverseProxy) {
    compose += `    expose:
      - "${port}"
`;
  } else {
    compose += `    ports:
      - "${port}:${port}"
`;
  }

  // Environment Variables
  compose += `    environment:
      - NODE_ENV=production
      - PORT=${port}
`;

  // Database Connection
  if (needsDatabase) {
    compose += generateDatabaseEnv(database, projectName);
    compose += `    depends_on:
      - ${database}
`;
  }

  // Volumes
  if (projectType !== 'static') {
    compose += `    volumes:
      - ./:/app
      - /app/node_modules
`;
  }

  // Networks
  compose += `    networks:
      - app-network
`;

  // Database Service
  if (needsDatabase) {
    compose += '\n' + generateDatabaseService(database, projectName);
  }

  // Reverse Proxy (nginx)
  if (needsReverseProxy) {
    compose += '\n' + generateNginxService(answers);
  }

  // Networks Definition
  compose += `
networks:
  app-network:
    driver: bridge
`;

  // Volumes Definition
  if (needsDatabase) {
    compose += `
volumes:
  ${database}-data:
    driver: local
`;
  }

  return compose;
}

function generateDatabaseEnv(database, projectName) {
  switch (database) {
    case 'postgres':
      return `      - POSTGRES_USER=\${POSTGRES_USER}
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD}
      - POSTGRES_DB=\${POSTGRES_DB}
      - DATABASE_URL=\${DATABASE_URL}
`;
    case 'mongodb':
      return `      - MONGODB_URI=\${MONGODB_URI}
`;
    case 'redis':
      return `      - REDIS_URL=\${REDIS_URL}
`;
    case 'mysql':
      return `      - DATABASE_URL=\${DATABASE_URL}
`;
    default:
      return '';
  }
}

function generateDatabaseService(database, projectName) {
  switch (database) {
    case 'postgres':
      return `  postgres:
    image: postgres:16-alpine
    container_name: ${projectName}-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=\${POSTGRES_USER}
      - POSTGRES_PASSWORD=\${POSTGRES_PASSWORD}
      - POSTGRES_DB=\${POSTGRES_DB}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
`;

    case 'mongodb':
      return `  mongodb:
    image: mongo:7-jammy
    container_name: ${projectName}-mongodb
    restart: unless-stopped
    environment:
      - MONGO_INITDB_ROOT_USERNAME=\${MONGO_INITDB_ROOT_USERNAME}
      - MONGO_INITDB_ROOT_PASSWORD=\${MONGO_INITDB_ROOT_PASSWORD}
    volumes:
      - mongodb-data:/data/db
    networks:
      - app-network
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost:27017/test --quiet
      interval: 10s
      timeout: 5s
      retries: 5
`;

    case 'redis':
      return `  redis:
    image: redis:7-alpine
    container_name: ${projectName}-redis
    restart: unless-stopped
    volumes:
      - redis-data:/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
`;

    case 'mysql':
      return `  mysql:
    image: mysql:8
    container_name: ${projectName}-mysql
    restart: unless-stopped
    environment:
      - MYSQL_ROOT_PASSWORD=\${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=\${MYSQL_DATABASE}
      - MYSQL_USER=\${MYSQL_USER}
      - MYSQL_PASSWORD=\${MYSQL_PASSWORD}
    volumes:
      - mysql-data:/var/lib/mysql
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
`;

    default:
      return '';
  }
}

function generateNginxService(answers) {
  const { projectName, port, domain, needsSSL } = answers;

  let nginx = `  nginx:
    image: nginx:alpine
    container_name: ${projectName}-nginx
    restart: unless-stopped
    ports:
      - "80:80"
`;

  if (needsSSL) {
    nginx += `      - "443:443"
`;
  }

  nginx += `    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
`;

  if (needsSSL && domain) {
    nginx += `      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
`;
  }

  nginx += `    depends_on:
      - app
    networks:
      - app-network
`;

  if (needsSSL && domain) {
    nginx += `
  certbot:
    image: certbot/certbot
    container_name: ${projectName}-certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $\${!}; done;'"
`;
  }

  return nginx;
}

module.exports = { generateDockerCompose };
