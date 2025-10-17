# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-18

### Added
- 🎯 Interactive project initialization with `kmuc-hoster init`
- 🐳 Automated Dockerfile generation for Express, Next.js, React Vite, Node.js, and static sites
- 🗄️ Database support for PostgreSQL, MongoDB, MySQL, and Redis
- 🌐 Nginx reverse proxy and Let's Encrypt SSL automation
- 📦 One-command deployment with `kmuc-hoster publish`
- 📊 Smart log viewing with `kmuc-hoster logs` and `--detailed` flag
- 📖 Interactive HTML documentation with `kmuc-hoster help`
- 💾 Progress tracking and resume functionality
- 🚀 VPS/Server deployment scripts with SSH
- ⚡ Multi-stage Docker builds for optimized images
- 🛡️ Security best practices (non-root users, health checks)
- 🔄 Automatic environment file creation from templates

### Features
- **Supported Frameworks:**
  - Express.js (Node.js backend)
  - Next.js (React with SSR/SSG)
  - React Vite (SPA)
  - Node.js Basic
  - Static HTML/CSS/JS

- **Database Options:**
  - PostgreSQL 16 Alpine
  - MongoDB 7
  - MySQL 8
  - Redis 7 Alpine

- **Deployment Targets:**
  - Local Docker Compose
  - VPS/Server via SSH
  - Cloud-ready configurations

### Documentation
- Comprehensive README with examples
- Interactive HTML help page
- Project-specific README generation
- Inline command help

### License
- MIT License (Private & Non-Commercial Use Only)
- Free for personal, educational, and non-profit use
- Commercial license required for business use
