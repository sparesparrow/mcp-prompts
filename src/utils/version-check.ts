/**
 * Check Node.js version compatibility
 */
export function checkNodeVersion() {
  const currentVersion = process.versions.node;
  const [major] = currentVersion.split('.').map(Number);

  if (major < 18) {
    console.warn(`Warning: You are using Node.js v${currentVersion}. This package is designed for Node.js v18 or later.`);
  } else if (major >= 23) {
    console.warn(`Note: You are using Node.js v${currentVersion}. Some import statements may require .js extensions.`);
  }
}