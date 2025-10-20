# 🚀 KMUC Dev CLI

**Your complete development toolkit in one CLI** - Streamline your entire workflow from project init to production deploy with Docker, CI/CD, monitoring, and more.

[![npm version](https://img.shields.io/npm/v/kmuc-dev-cli.svg)](https://www.npmjs.com/package/kmuc-dev-cli)
[![License](https://img.shields.io/badge/license-MIT%20(Private%20%26%20Non--Commercial)-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

---

## ✨ Why KMUC Dev CLI?

Stop juggling multiple tools. One CLI for everything:

- 🎯 **Project Setup** - Initialize production-ready Docker projects in seconds
- 🐳 **Container Management** - Status dashboard, logs, updates, cleanup
- 🗄️ **Database Tools** - Direct DB access, backups, migrations
- 📊 **Monitoring** - Health checks, resource usage, live dashboards
- 🔄 **CI/CD** - Auto-generate GitHub Actions, GitLab CI configs
- 🌐 **SSL & Domains** - Automated Let's Encrypt setup and renewal
- 🛠️ **Dev Mode** - Hot-reload, debugging, instant feedback

---

## 📦 Installation

```bash
npm install -g kmuc-dev-cli
```

Verify installation:

```bash
kmuc --version
```

---

## 🚀 Quick Start

```bash
# 1. Initialize your project
cd my-project
kmuc init

# 2. Start everything
kmuc publish

# 3. Monitor status
kmuc status --watch
```

That's it! Your app is running in Docker with all services configured.

---

## 🆕 What's New in v2.1.0

- 🛠️ **kmuc dev** - Development mode with hot-reload and debug ports
- 🗄️ **kmuc db:connect** - Auto-connect to any database (PostgreSQL, MongoDB, MySQL, Redis)
- 💾 **kmuc backup** - Complete backup/restore system for containers and databases
- 🏥 **kmuc health** - Comprehensive health checks for your entire stack
- 🔒 **kmuc ssl:*** - SSL certificate management (status, renew, auto-renewal)
- ⚙️ **kmuc ci:github** & **ci:gitlab** - Generate CI/CD workflows
- 📊 Enhanced **kmuc status** - Real-time container monitoring
- 🧹 Improved **kmuc clean** - Interactive cleanup wizard

---

## 📚 Core Commands

### Project Lifecycle

```bash
kmuc init           # Interactive project setup
kmuc publish        # Build & deploy everything
kmuc dev            # Start development mode
kmuc status         # Container status dashboard
kmuc logs           # Intelligent log viewer
kmuc health         # Health monitoring
```

### Container Management

```bash
kmuc update         # Update Docker images
kmuc clean          # Clean unused resources
kmuc restart        # Restart services
kmuc stop           # Stop all containers
```

### Database Tools

```bash
kmuc db:connect     # Auto-connect to database
kmuc backup         # Create full backup
kmuc backup:restore # Restore from backup
```

### CI/CD & Deploy

```bash
kmuc ci:github      # Generate GitHub Actions
kmuc deploy         # Deploy to server
kmuc ssl:renew      # Renew SSL certificates
```

### Utilities

```bash
kmuc help           # Interactive documentation
kmuc clean          # Clean Docker resources
```

---

## 🎨 Supported Technologies

### Frameworks & Languages

| Type | Frameworks |
|------|-----------|
| **JavaScript** | Express.js, Next.js, React (Vite), Node.js |
| **Python** | FastAPI, Django, Flask |
| **Static** | HTML/CSS/JS with nginx |

### Databases

| Database | Version | Features |
|----------|---------|----------|
| **PostgreSQL** | 16 Alpine | Health checks, auto-backup |
| **MongoDB** | 7 | Authentication, replication-ready |
| **Redis** | 7 Alpine | Caching, pub/sub |
| **MySQL** | 8 | Full-featured relational DB |

### Infrastructure

- Docker & Docker Compose
- nginx Reverse Proxy
- Let's Encrypt SSL/TLS
- GitHub Actions & GitLab CI
- VPS & Cloud deployment

---

## 💡 Feature Highlights

### 📊 Status Dashboard

```bash
kmuc status --watch
```

Real-time container monitoring with:
- Live CPU & Memory usage
- Health status indicators
- Port mappings
- Auto-refresh every 2 seconds

### 🔄 Smart Updates

```bash
kmuc update
```

- Checks for available image updates
- Creates backup before updating
- Rolling updates (zero downtime)
- Automatic health verification

### 🧹 Intelligent Cleanup

```bash
kmuc clean
```

Interactive cleanup wizard:
- Stopped containers
- Dangling images
- Unused volumes
- Build cache
- Shows space freed

### 🗄️ Database Access

```bash
kmuc db:connect
```

Automatically:
- Detects your database type
- Opens the right client (psql, mongo, mysql, redis-cli)
- Passes credentials from .env

### 🛠️ Development Mode

```bash
kmuc dev
```

- Volume mounts for hot-reload
- Debug ports enabled
- Development environment
- Live log streaming

---

## 📖 Usage Examples

### Full-Stack Node.js App with PostgreSQL

```bash
kmuc init
# Select: Express.js App
# Select: PostgreSQL
# Select: VPS deployment

kmuc publish
# Access at: http://localhost:3000

kmuc db:connect
# Opens psql with your credentials

kmuc backup
# Creates timestamped backup

kmuc ci:github
# Generates .github/workflows/deploy.yml
```

### Python FastAPI with MongoDB

```bash
kmuc init
# Select: Python FastAPI
# Select: MongoDB  
# Select: Local development

kmuc dev
# Starts with hot-reload

kmuc logs --detailed
# Watch all logs with timestamps
```

### Static Site with SSL

```bash
kmuc init
# Select: Static Website
# Select: VPS deployment
# Enter: yourdomain.com

kmuc publish
# Deploys locally first

./scripts/setup-domain.sh
# Sets up nginx + Let's Encrypt

kmuc ssl:status
# Check SSL expiry
```

---

## 🔧 Advanced Usage

### Container Status with Live Updates

```bash
kmuc status --watch
```

### Detailed Logs from All Services

```bash
kmuc logs --detailed
```

### Force Update All Images

```bash
kmuc update --force
```

### Deep Clean Everything

```bash
kmuc clean --all
```

### Development with Debug Ports

```bash
kmuc dev --debug
```

---

## 🛠️ Common Workflows

### Daily Development

```bash
kmuc dev                    # Start dev environment
kmuc logs                   # Watch logs
kmuc status                 # Check status
```

### Before Deployment

```bash
kmuc health                 # Verify all healthy
kmuc backup                 # Create backup
kmuc update                 # Get latest images
kmuc publish                # Deploy
```

### Maintenance

```bash
kmuc ssl:renew              # Renew certificates
kmuc clean                  # Free up space
kmuc status                 # Verify everything running
```

---

## 📄 License

**MIT License - Private & Non-Commercial Use Only**

### ✅ Free for:
- Personal projects
- Learning & education
- Open source (non-commercial)
- Non-profit organizations
- Academic research

### ⚠️ Requires commercial license for:
- Commercial products or services
- Paid software or SaaS
- Revenue-generating applications
- Business operations

For commercial licensing, contact the maintainers.

See [LICENSE](LICENSE) for full details.

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
git clone https://github.com/KmucDigital/dev-cli.git
cd dev-cli
npm install
npm link
```

---

## 📞 Support

- 📖 **Documentation**: Run `kmuc help`
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/KmucDigital/dev-cli/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/KmucDigital/dev-cli/discussions)

---

## 🌟 Show Your Support

- ⭐ Star the repository
- 🐦 Share with your network
- 🐛 Report bugs or request features
- 📝 Contribute improvements

---

**Made with ❤️ by KMUC Digital**

*Modern development, simplified - One CLI to rule them all*
