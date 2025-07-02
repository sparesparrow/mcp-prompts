<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP-Prompts Server - Install & Compose</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/simpledotcss/simple.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <meta name="description" content="MCP-Prompts: Modular prompt management for AI workflows. Install, configure, and compose your server.">
  <style>
    .build-section { background: #f8fafc; border-radius: 8px; padding: 1.5em; margin: 2em 0; }
    .script-box { background: #222; color: #fff; padding: 1em; border-radius: 6px; font-family: monospace; position: relative; }
    .copy-btn { position: absolute; top: 10px; right: 10px; background: #3498db; color: #fff; border: none; border-radius: 4px; padding: 0.3em 0.8em; cursor: pointer; }
    nav { margin-bottom: 2em; }
    .logo { font-size: 2em; margin-right: 0.5em; }
    .callout { background: #e0f7fa; border-left: 4px solid #00bcd4; padding: 1em; margin: 1.5em 0; border-radius: 6px; }
    @media (max-width: 600px) { .build-section { padding: 0.5em; } }
  </style>
</head>
<body>
  <header>
    <span class="logo"><i class="fas fa-comments"></i></span>
    <strong>MCP-Prompts Server</strong>
    <nav>
      <a href="https://sparesparrow.github.io/mcp-prompts/">Main Server</a> |
      <a href="https://sparesparrow.github.io/mcp-prompts-ts/">TypeScript</a> |
      <a href="https://sparesparrow.github.io/mcp-prompts-catalog/">Catalog</a> |
      <a href="https://sparesparrow.github.io/mcp-prompts-contracts/">Contracts</a> |
      <a href="https://sparesparrow.github.io/mcp-prompts-rs/">Rust</a>
    </nav>
  </header>
  <main>
    <div class="callout">
      <strong>MCP-Prompts</strong> is a modular, open-source prompt management and orchestration system for AI and automation workflows. Part of the MCP-Prompts project family, it provides robust, extensible tools for managing prompts across languages and platforms.
    </div>
    <h1>MCP-Prompts Server</h1>
    <section class="callout">
      <h2>Quickstart</h2>
      <ul>
        <li>Clone: <code>git clone https://github.com/sparesparrow/mcp-prompts.git</code></li>
        <li>Run with Docker: <code>docker pull sparesparrow/mcp-prompts:latest</code></li>
        <li>Run with npx: <code>npx -y @sparesparrow/mcp-prompts</code></li>
        <li>Docs: <a href="https://github.com/sparesparrow/mcp-prompts#readme">README</a></li>
      </ul>
    </section>
    <p>Modular, open-source prompt management and orchestration for AI and automation workflows.</p>
    <section>
      <h2>Features</h2>
      <ul>
        <li>Semantic search and prompt catalog</li>
        <li>Multiple storage adapters (memory, Postgres, MDC)</li>
        <li>REST API & Server-Sent Events (SSE)</li>
        <li>Docker, npx, npm, uv install options</li>
        <li>Extensible, tested, and production-ready</li>
      </ul>
    </section>
    <section class="build-section">
      <h2>Build Script Composer</h2>
      <form id="buildForm">
        <label>Install Method:
          <select id="installMethod">
            <option value="docker">Docker Compose</option>
            <option value="docker-run">Docker Run</option>
            <option value="npx">npx</option>
            <option value="npm">npm</option>
            <option value="uv">uv</option>
          </select>
        </label>
        <label>Storage Adapter:
          <select id="storageAdapter">
            <option value="memory">Memory</option>
            <option value="postgres">Postgres</option>
            <option value="mdc">MDC</option>
          </select>
        </label>
        <label>Enable SSE:
          <input type="checkbox" id="enableSSE" checked>
        </label>
        <label>Server Port:
          <input type="number" id="serverPort" value="8080" min="1" max="65535">
        </label>
        <button type="button" onclick="generateScript()">Generate Script</button>
      </form>
      <div id="scriptOutput" class="script-box" style="display:none;">
        <button class="copy-btn" onclick="copyScript()">Copy</button>
        <pre id="scriptText"></pre>
      </div>
    </section>
    <section>
      <h2>Contributing</h2>
      <p>We welcome contributions! Please see <a href="https://github.com/sparesparrow/mcp-prompts/blob/main/CONTRIBUTING.md">CONTRIBUTING.md</a> for guidelines.</p>
    </section>
    <section>
      <h2>License</h2>
      <p>MIT License. &copy; sparesparrow</p>
    </section>
    <section>
      <h2>Support</h2>
      <ul>
        <li><strong>Bugs & Issues:</strong> <a href="https://github.com/sparesparrow/mcp-prompts/issues">GitHub Issues</a></li>
        <li><strong>Discussions:</strong> <a href="https://github.com/sparesparrow/mcp-prompts/discussions">GitHub Discussions</a></li>
        <li><strong>Commercial Support:</strong> <a href="mailto:support@sparrowai.tech">Sparrow AI & Tech</a></li>
      </ul>
    </section>
  </main>
  <footer>
    <p>Part of the <a href="https://sparesparrow.github.io/mcp-prompts/">MCP-Prompts Project</a> &mdash; <a href="https://github.com/sparesparrow/mcp-prompts">GitHub</a></p>
  </footer>
  <script>
    function generateScript() {
      const method = document.getElementById('installMethod').value;
      const adapter = document.getElementById('storageAdapter').value;
      const sse = document.getElementById('enableSSE').checked;
      const port = document.getElementById('serverPort').value;
      let script = '';
      if (method === 'docker') {
        script = `version: '3.8'\nservices:\n  mcp-prompts:\n    image: sparesparrow/mcp-prompts:latest\n    ports:\n      - "${port}:8080"\n    environment:\n      - STORAGE_ADAPTER=${adapter}\n      - ENABLE_SSE=${sse ? 'true' : 'false'}`;
      } else if (method === 'docker-run') {
        script = `docker run -d -p ${port}:8080 -e STORAGE_ADAPTER=${adapter} -e ENABLE_SSE=${sse ? 'true' : 'false'} sparesparrow/mcp-prompts:latest`;
      } else if (method === 'npx') {
        script = `npx @sparesparrow/mcp-prompts --adapter ${adapter} --port ${port}${sse ? ' --sse' : ''}`;
      } else if (method === 'npm') {
        script = `npm install -g @sparesparrow/mcp-prompts\nmcp-prompts --adapter ${adapter} --port ${port}${sse ? ' --sse' : ''}`;
      } else if (method === 'uv') {
        script = `uv pip install mcp-prompts\nmcp-prompts --adapter ${adapter} --port ${port}${sse ? ' --sse' : ''}`;
      }
      document.getElementById('scriptText').textContent = script;
      document.getElementById('scriptOutput').style.display = 'block';
    }
    function copyScript() {
      const text = document.getElementById('scriptText').textContent;
      navigator.clipboard.writeText(text);
    }
  </script>
</body>
</html> 