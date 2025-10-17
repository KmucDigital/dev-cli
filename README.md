# 🚀 KMUC Hoster CLI

**Professional Docker hosting made easy** - Generate production-ready Dockerfiles, docker-compose configurations, and deployment scripts for your Node.js, Next.js, React, and static web projects.

[![npm version](https://img.shields.io/npm/v/kmuc-hoster-cli.svg)](https://www.npmjs.com/package/kmuc-hoster-cli)
[![License](https://img.shields.io/badge/license-MIT%20(Private%20%26%20Non--Commercial)-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

---

## ✨ Features

- 🎯 **Interactive Setup** - Answer a few questions and get a complete Docker configuration
- 🐳 **Optimized Dockerfiles** - Multi-stage builds, non-root users, health checks
- 🗄️ **Database Support** - PostgreSQL, MongoDB, MySQL, Redis with automatic configuration
- 🌐 **Domain & SSL** - Automated nginx reverse proxy and Let's Encrypt SSL setup
- 📦 **One-Command Deploy** - `kmuc-hoster publish` builds and starts everything
- 📊 **Smart Logs** - Intelligent log filtering with error highlighting
- 📖 **Built-in Documentation** - Interactive HTML documentation via `kmuc-hoster help`
- 💾 **Progress Tracking** - Resume interrupted setups automatically

---

## 📦 Installation

### Global Installation (Recommended)

```bash
npm install -g kmuc-hoster-cli
```

### Verify Installation

```bash
kmuc-hoster --version
```

---

## 🚀 Quick Start

### 1. Initialize Your Project

```bash
cd my-project
kmuc-hoster init
```

Answer the interactive questions:
- Project name
- Project type (Express, Next.js, React, etc.)
- Port configuration
- Database selection
- Deployment target

### 2. Deploy Locally

```bash
kmuc-hoster publish
```

That's it! Your application is now running in Docker containers.

---

## 📚 Available Commands

### `kmuc-hoster init`

Initialize a new project with complete Docker setup.

**Creates:**
- `Dockerfile` - Optimized for your framework
- `docker-compose.yml` - With all services
- `.dockerignore` - Excludes unnecessary files
- `.env.example` - Environment variables template
- `README.md` - Project documentation
- `scripts/` - Deployment scripts (for VPS/Cloud)

```bash
kmuc-hoster init
```

---

### `kmuc-hoster publish`

Build and start your Docker containers automatically.

**What it does:**
1. ✅ Validates Docker installation
2. ✅ Creates `.env` from `.env.example` if needed
3. ✅ Validates Dockerfile syntax
4. ✅ Builds Docker images
5. ✅ Starts all containers
6. ✅ Shows application URL

```bash
kmuc-hoster publish
```

---

### `kmuc-hoster logs`

View container logs with intelligent filtering.

**Features:**
- 🎯 Auto-detects main service
- 🔴 Highlights errors in red
- 🟡 Highlights warnings in yellow
- 🟢 Highlights success messages in green

```bash
# Smart filtered logs
kmuc-hoster logs

# Detailed logs with timestamps
kmuc-hoster logs --detailed
```

---

### `kmuc-hoster deploy`

Deploy your project to a VPS/Server.

```bash
kmuc-hoster deploy
```

---

### `kmuc-hoster help`

Open the interactive documentation in your browser.

```bash
kmuc-hoster help
```

---

## 🎨 Supported Technologies

### Project Types

| Type | Description |
|------|-------------|
| **Express.js** | Node.js backend with Express framework |
| **Next.js** | React framework with SSR/SSG |
| **React Vite** | Single Page Application with Vite |
| **Node.js Basic** | Simple Node.js application |
| **Static Website** | HTML/CSS/JS without build process |

### Databases

| Database | Image | Features |
|----------|-------|----------|
| **PostgreSQL** | `postgres:16-alpine` | Health checks, persistent volumes |
| **MongoDB** | `mongo:7-jammy` | Automatic authentication setup |
| **Redis** | `redis:7-alpine` | In-memory caching |
| **MySQL** | `mysql:8` | Relational database |

### Deployment Targets

- **Local** - Docker Compose for development
- **VPS/Server** - SSH-based deployment with scripts
- **Cloud** - Ready for AWS, Google Cloud, Azure

---

## 💡 Usage Examples

### Express.js API with PostgreSQL

```bash
kmuc-hoster init
# Select: Express.js App
# Select: PostgreSQL
# Select: VPS/Server deployment

kmuc-hoster publish
# Access at: http://localhost:3000
```

### Next.js App with Domain & SSL

```bash
kmuc-hoster init
# Select: Next.js App
# Select: No database
# Select: VPS/Server
# Enter: example.com

# Local testing
kmuc-hoster publish

# Production deployment
./scripts/deploy.sh
./scripts/setup-domain.sh
```

### Static Website

```bash
kmuc-hoster init
# Select: Static Website
# Select: Local deployment

kmuc-hoster publish
# Access at: http://localhost:8080
```

---

## 🔧 Common Commands

### Docker Management

```bash
# View container status
docker-compose ps

# View logs
kmuc-hoster logs

# Restart containers
docker-compose restart

# Stop containers
docker-compose down

# Rebuild without cache
docker-compose build --no-cache
```

### Debugging

```bash
# Detailed logs
kmuc-hoster logs --detailed

# Enter container shell
docker-compose exec app sh

# View container resources
docker stats
```

---

## 🛠️ Troubleshooting

### Docker not found
```bash
# Install Docker
# Visit: https://docs.docker.com/get-docker/
```

### Port already in use
```bash
# Change port in docker-compose.yml
# Or stop the conflicting service
```

### Build failed
```bash
# Regenerate correct Dockerfiles
kmuc-hoster init
```

### Container won't start
```bash
# Check logs
kmuc-hoster logs --detailed

# Verify .env configuration
cat .env
```

---

## 📄 License

**MIT License - Private & Non-Commercial Use Only**

### ✅ Allowed (FREE):
- Personal projects
- Learning & education
- Open source projects (non-commercial)
- Non-profit organizations
- Academic research

### ⚠️ NOT Allowed without commercial license:
- Commercial products or services
- Paid software or SaaS platforms
- Revenue-generating applications
- Business operations

For commercial use, please contact the maintainers for a commercial license.

See [LICENSE](LICENSE) for full details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

### Development Setup

```bash
git clone https://github.com/KmucDigital/hoster-cli.git
cd hoster-cli
npm install
npm link
```

---

## 📞 Support

- 📖 **Documentation**: Run `kmuc-hoster help`
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/KmucDigital/hoster-cli/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/KmucDigital/hoster-cli/discussions)

---

## 🌟 Show Your Support

If this tool helped you, please consider:
- ⭐ Starring the repository
- 🐦 Sharing with your network
- 🐛 Reporting bugs or requesting features

---

**Made with ❤️ by KMUC Digital**

*Simplifying Docker hosting for developers*
