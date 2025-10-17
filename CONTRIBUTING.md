# Contributing to KMUC Hoster CLI

Thank you for your interest in contributing to KMUC Hoster CLI! We welcome contributions from the community.

## 🚀 Getting Started

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YourUsername/hoster-cli.git
   cd hoster-cli
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Link the CLI locally**
   ```bash
   npm link
   ```

4. **Test your changes**
   ```bash
   kmuc-hoster --version
   kmuc-hoster init
   ```

## 📝 Development Guidelines

### Code Style

- Use **CommonJS** modules (`require`/`module.exports`)
- Use **async/await** for asynchronous operations
- Follow existing code formatting
- Use meaningful variable and function names
- Add comments for complex logic

### File Structure

```
kmuc-hoster-ci/
├── bin/
│   └── cli.js              # CLI entry point
├── src/
│   ├── commands/           # Command implementations
│   ├── generators/         # File generators (Dockerfile, compose, etc.)
│   ├── prompts/            # Inquirer question definitions
│   ├── templates/          # HTML and other templates
│   └── utils/              # Utility functions
├── LICENSE
├── README.md
└── package.json
```

### Adding a New Command

1. Create a new file in `src/commands/yourcommand.js`
2. Export a function: `module.exports = { yourCommand }`
3. Register it in `bin/cli.js`:
   ```javascript
   const { yourCommand } = require('../src/commands/yourcommand');
   
   program
     .command('yourcommand')
     .description('Description of your command')
     .action(yourCommand);
   ```

### Adding a New Project Type

1. Update `src/prompts/questions.js` to include the new type
2. Add generator in `src/generators/dockerfile.js`:
   ```javascript
   function generateYourTypeDockerfile(port) {
     return `FROM ...`;
   }
   ```
3. Update the switch statement in `generateDockerfile()`

### Adding a New Database

1. Update `src/prompts/questions.js` database choices
2. Add case in `src/generators/compose.js`:
   - `generateDatabaseEnv()`
   - `generateDatabaseService()`
3. Add env template in `src/commands/init.js`: `generateEnvExample()`

## 🧪 Testing

### Manual Testing

Before submitting a pull request, test these scenarios:

1. **Init Command**
   ```bash
   mkdir test-project
   cd test-project
   kmuc-hoster init
   # Test all project types and database combinations
   ```

2. **Publish Command**
   ```bash
   kmuc-hoster publish
   # Verify containers start without errors
   ```

3. **Logs Command**
   ```bash
   kmuc-hoster logs
   kmuc-hoster logs --detailed
   ```

4. **Help Command**
   ```bash
   kmuc-hoster help
   # Verify HTML page opens in browser
   ```

### Edge Cases to Test

- Running commands in root directory (should fail with helpful message)
- Missing docker-compose.yml (should show clear error)
- Invalid Dockerfile syntax (should be caught by validation)
- Interrupted init (should save progress)

## 📦 Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clear, concise code
   - Update documentation if needed
   - Test thoroughly

3. **Commit your changes**
   ```bash
   git commit -m "Add: Brief description of changes"
   ```
   
   Use conventional commit prefixes:
   - `Add:` for new features
   - `Fix:` for bug fixes
   - `Update:` for improvements
   - `Docs:` for documentation changes

4. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request**
   - Describe what your PR does
   - Reference any related issues
   - Include screenshots if relevant

## 🐛 Reporting Bugs

### Before Submitting

- Check if the bug has already been reported
- Test with the latest version
- Collect relevant information

### Bug Report Template

```markdown
**Describe the bug**
A clear description of the bug.

**To Reproduce**
Steps to reproduce:
1. Run '...'
2. See error

**Expected behavior**
What you expected to happen.

**Environment:**
- OS: [e.g., Windows 11, macOS 14, Ubuntu 22.04]
- Node.js version: [run `node --version`]
- KMUC Hoster CLI version: [run `kmuc-hoster --version`]
- Docker version: [run `docker --version`]

**Additional context**
Add any other context, logs, or screenshots.
```

## 💡 Feature Requests

We welcome feature requests! Please:

1. Check if the feature has already been requested
2. Clearly describe the feature and its use case
3. Explain why it would be useful
4. Consider contributing the implementation

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License - Private & Non-Commercial Use Only).

## 🤝 Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Provide constructive feedback
- Focus on what is best for the community

## ❓ Questions?

- Open a [Discussion](https://github.com/KmucDigital/hoster-cli/discussions)
- Check existing [Issues](https://github.com/KmucDigital/hoster-cli/issues)
- Read the [Documentation](README.md)

---

**Thank you for contributing to KMUC Hoster CLI!** 🚀
