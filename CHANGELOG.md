# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.2] - 2025-01-19

### Fixed
- **Port Mapping**: Fixed port mapping for static sites and React Vite projects
  - Static sites now correctly map external port to internal port 80
  - React Vite projects now use nginx on port 80 internally
  - Resolves issue where requests failed when custom ports were selected

- **VPS Deployment Scripts**: Fixed `APP_DIR is not defined` error
  - Corrected variable escaping in SSH heredoc
  - All `${APP_DIR}` references now properly escaped as `\${APP_DIR}`

- **Deployment tar errors**: Fixed "file changed as we read it" errors
  - Added `--warning=no-file-changed` and `--warning=no-file-removed` flags
  - Extended exclude patterns (dist, build, .next, coverage, .cache)
  - Archive verification before upload
  - Graceful handling of tar warnings vs actual errors

### Enhanced
- **`kmuc dev` - Real Hot-Reload**: Implemented true hot-reload functionality
  - **Node.js Apps**: Automatic server restart with nodemon on file changes
  - **Static Sites**: Live file sync with nginx (no rebuild needed)
  - **React Vite**: Optimized dist mounting for faster reload
  - Auto-detects project type for optimal dev experience

- **`kmuc dev` - No Caching**: Eliminated caching issues in development
  - Disabled all browser caching for static sites
  - Disabled nginx etag and if-modified-since headers
  - Added Cache-Control headers: `no-store, no-cache, must-revalidate`
  - Separate nginx.dev.conf with aggressive no-cache policy
  - Changes are immediately visible without hard refresh

- **VPS Deployment Modes**: Added deployment mode selection
  - **Script Mode** (default): Generates deploy.sh for manual execution
  - **Direct Mode**: Automatically deploys via SSH after project setup
  - SSH password prompt for direct deployment without SSH keys

- **`kmuc deploy` - Automatic SSH Deployment**: New smart deployment command
  - Automatically detects VPS deployment configuration
  - Executes deploy.sh via SSH with live output streaming
  - No manual script execution needed - just run `kmuc deploy`
  - Falls back to manual instructions if deployment fails

- **`.kmucignore` - Smart Deployment Filtering**: New ignore file system
  - Automatically excludes node_modules, .git, build artifacts, etc.
  - Project-type specific exclusions (Next.js, Vite, etc.)
  - Customizable - edit `.kmucignore` to add your own patterns
  - Significantly reduces deployment archive size
  - Compatible with gitignore syntax

## [2.1.1] - 2025-01-18

### Fixed
- **Windows Compatibility**: Fixed `COMPOSE_FILE` path separator (`;` for Windows, `:` for Unix)
- **Better Error Messages**: Improved error handling in `kmuc publish`:
  - Added package.json validation check
  - More helpful error messages with specific solutions
  - Suggests Docker cache clearing when build fails
- **Dev Mode**: Fixed `kmuc dev` on Windows with correct path separator

### Changed
- Enhanced publish command to check for package.json before building
- Better Docker build error diagnostics

## [2.1.0] - 2025-01-18

### Added
- 🛠️ **`kmuc dev`** - Development mode with hot-reload, debug ports, and live logs
- 🗄️ **`kmuc db:connect`** - Auto-connect to PostgreSQL, MongoDB, MySQL, or Redis
- 💾 **`kmuc backup`** - Complete backup/restore system for containers and databases
- 🏥 **`kmuc health`** - Comprehensive health checks for entire stack
- 🔒 **`kmuc ssl:status`**, **`ssl:renew`**, **`ssl:auto`** - SSL certificate management
- ⚙️ **`kmuc ci:github`** & **`ci:gitlab`** - CI/CD workflow generators
- 📊 Enhanced **`kmuc status`** - Real-time container monitoring with --watch
- 🧹 Improved **`kmuc clean`** - Interactive cleanup wizard

### Enhanced
- Static site support with automatic Express.js server generation
- Smart Docker image update system
- Better error messages and validation
- Modern HTML documentation (v2.1.0)

### Fixed
- Inquirer version locked to 8.2.7 for CommonJS compatibility
- All dependencies use stable versions

## [2.0.0] - 2024-12-15

### Changed
- Complete rebrand from "KMUC Hoster CLI" to "KMUC Dev CLI"
- Binary: `kmuc-hoster` → `kmuc`
- Focus: hosting-only → complete development toolkit

### Added
- `kmuc status` - Container dashboard
- `kmuc update` - Image updates
- `kmuc clean` - Resource cleanup

## [1.0.0] - 2024-11-20

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
