# Contributing to MCP-Prompts

First off, thank you for considering contributing to MCP-Prompts! It's people like you that make this project great. Your contributions are incredibly valuable.

This document provides a set of guidelines for contributing to this project. These are mostly guidelines, not strict rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## 📜 Code of Conduct

This project and everyone participating in it is governed by the [MCP-Prompts Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior.

## 🚀 How Can I Contribute?

There are many ways to contribute, from writing tutorials or blog posts, improving the documentation, submitting bug reports and feature requests or writing code which can be incorporated into the project itself.

### Reporting Bugs

-   Use the **"Bug report"** issue template.
-   Include clear steps to reproduce the issue.
-   Describe the expected behavior and what happened instead.
-   Provide details about your environment (OS, Node.js version, Docker version, etc.).

### Suggesting Enhancements

-   Use the **"Feature request"** issue template.
-   Explain the problem you're trying to solve and the desired outcome.
-   Provide as much detail and context as possible.

### Your First Code Contribution

Unsure where to begin? You can start by looking for issues tagged `good first issue` or `help wanted`.

## 💻 Development Workflow

Ready to contribute code? Here's how to set up your environment and get started.

### 1. Fork & Clone the Repository

First, fork the repository to your own GitHub account. Then, clone it to your local machine:

```bash
git clone https://github.com/YOUR_USERNAME/mcp-prompts.git
cd mcp-prompts
```

### 2. Install Dependencies

This project uses `npm` for dependency management.

```bash
npm install
```

This will install all necessary dependencies and run the initial build.

### 3. Running the Server in Development Mode

To run the server with hot-reloading for development, use the `dev` script:

```bash
npm run dev
```

This will start the server on `http://localhost:3003` and automatically restart it when you make changes to the source code.

### 4. Running Tests

We have unit and integration tests. It's important to run them to ensure your changes don't break existing functionality.

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration
```

Please ensure all tests pass before submitting a pull request.

### 5. Code Style and Linting

We use ESLint and Prettier to maintain a consistent code style. Before you commit, you can run the linter to check for issues:

```bash
npm run lint
```

Most style issues can be automatically fixed by your code editor if you have the Prettier and ESLint extensions installed.

## 🚀 Submitting Changes

When you're ready to submit your changes, please follow these steps:

1.  **Create a new branch** for your changes:
    ```bash
    git checkout -b feature/your-awesome-feature
    ```
2.  **Commit your changes** with a descriptive commit message. We follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification.
    ```bash
    git commit -m "feat: Add support for XYZ"
    ```
3.  **Push your branch** to your fork:
    ```bash
    git push origin feature/your-awesome-feature
    ```
4.  **Open a Pull Request** to the `main` branch of the main repository.
5.  **Fill out the PR template** with a clear description of your changes, why they are needed, and how you tested them.
6.  **Link to any relevant issues** in your PR description (e.g., `Fixes #123`).

We will review your PR as soon as possible. Thank you for your contribution!

## Using Issue Templates
- Please use the provided templates for bug reports and feature requests. This helps us triage and resolve issues faster.

## Security
- Please report vulnerabilities privately via [SECURITY.md](./SECURITY.md).

## Pull Requests
- Fork the repo and create a feature branch.
- Run `npm install` and `npm test` to ensure all tests pass.
- Submit a pull request with a clear description.

Thank you for helping improve MCP-Prompts! 