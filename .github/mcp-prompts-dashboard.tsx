import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, History, Server, Users, BarChart3, Settings, Upload, Download, Play, Copy, CheckCircle, AlertCircle, Clock, Database, FileText, GitBranch, Filter, RefreshCw, Eye, Code, Save, X, ChevronDown, ChevronRight, Globe, Shield, Zap, Activity } from 'lucide-react';

const MCPPromptsDashboard = () => {
  const [activeTab, setActiveTab] = useState('prompts');
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [prompts, setPrompts] = useState([
    {
      id: 'prompt-1',
      name: 'Code Review Assistant',
      description: 'Analyzes code for best practices, security issues, and optimization opportunities',
      category: 'Development',
      version: '2.1.0',
      lastModified: '2024-07-03T14:30:00Z',
      author: 'dev-team',
      tags: ['code', 'review', 'security'],
      template: 'Review the following code for:\n1. Security vulnerabilities\n2. Performance optimizations\n3. Best practices\n\nCode:\n```{{language}}\n{{code}}\n```\n\nProvide specific recommendations.',
      variables: ['language', 'code'],
      usage: 342,
      status: 'active'
    },
    {
      id: 'prompt-2',
      name: 'API Documentation Generator',
      description: 'Creates comprehensive API documentation from code snippets',
      category: 'Documentation',
      version: '1.5.2',
      lastModified: '2024-07-02T09:15:00Z',
      author: 'docs-team',
      tags: ['api', 'documentation', 'swagger'],
      template: 'Generate API documentation for:\n\nEndpoint: {{endpoint}}\nMethod: {{method}}\nParameters: {{parameters}}\n\nInclude:\n- Description\n- Request/Response examples\n- Error codes\n- Authentication requirements',
      variables: ['endpoint', 'method', 'parameters'],
      usage: 189,
      status: 'active'
    },
    {
      id: 'prompt-3',
      name: 'SQL Query Optimizer',
      description: 'Optimizes SQL queries for better performance',
      category: 'Database',
      version: '3.0.1',
      lastModified: '2024-07-01T16:45:00Z',
      author: 'db-team',
      tags: ['sql', 'optimization', 'database'],
      template: 'Optimize this SQL query:\n\n```sql\n{{query}}\n```\n\nDatabase: {{database_type}}\nTable size: {{table_size}}\n\nProvide:\n1. Optimized query\n2. Explanation of changes\n3. Performance impact estimate',
      variables: ['query', 'database_type', 'table_size'],
      usage: 76,
      status: 'draft'
    }
  ]);

  const [servers, setServers] = useState([
    { id: 'mcp-prompts', name: 'MCP Prompts', status: 'healthy', uptime: '99.9%', requests: 1234 },
    { id: 'filesystem', name: 'Filesystem', status: 'healthy', uptime: '99.8%', requests: 567 },
    { id: 'memory', name: 'Memory', status: 'healthy', uptime: '100%', requests: 890 },
    { id: 'github', name: 'GitHub', status: 'degraded', uptime: '95.2%', requests: 234 }
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showEditor, setShowEditor] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const categories = ['all', 'Development', 'Documentation', 'Database', 'Analysis', 'Content'];

  const filteredPrompts = prompts.filter(prompt => {
    const matchesSearch = prompt.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prompt.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prompt.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || prompt.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handlePromptClick = (prompt) => {
    setSelectedPrompt(prompt);
    setShowEditor(false);
    setShowVersionHistory(false);
  };

  const handleEditPrompt = (prompt) => {
    setEditingPrompt({...prompt});
    setShowEditor(true);
    setShowVersionHistory(false);
  };

  const handleSavePrompt = () => {
    if (editingPrompt.id) {
      setPrompts(prompts.map(p => p.id === editingPrompt.id ? editingPrompt : p));
    } else {
      setPrompts([...prompts, { ...editingPrompt, id: `prompt-${Date.now()}`, version: '1.0.0' }]);
    }
    setShowEditor(false);
    setEditingPrompt(null);
  };

  const renderPromptsList = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search prompts..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setEditingPrompt({
              name: '',
              description: '',
              category: 'Development',
              template: '',
              variables: [],
              tags: []
            });
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Prompt
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPrompts.map(prompt => (
          <div
            key={prompt.id}
            onClick={() => handlePromptClick(prompt)}
            className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
              selectedPrompt?.id === prompt.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900 line-clamp-1">{prompt.name}</h3>
              <span className={`px-2 py-1 rounded-full text-xs ${
                prompt.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {prompt.status}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{prompt.description}</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {prompt.tags.slice(0, 3).map(tag => (
                <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                  {tag}
                </span>
              ))}
              {prompt.tags.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
                  +{prompt.tags.length - 3}
                </span>
              )}
            </div>
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>v{prompt.version}</span>
              <span>{prompt.usage} uses</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPromptDetail = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{selectedPrompt.name}</h2>
          <p className="text-gray-600 mt-1">{selectedPrompt.description}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowVersionHistory(true)}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <History className="h-4 w-4" />
            History
          </button>
          <button
            onClick={() => handleEditPrompt(selectedPrompt)}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Edit className="h-4 w-4" />
            Edit
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Play className="h-4 w-4" />
            Test
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Template</h3>
              <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
                <Copy className="h-4 w-4" />
                Copy
              </button>
            </div>
            <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
              {selectedPrompt.template}
            </pre>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Version:</span>
                <span className="font-medium">v{selectedPrompt.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Category:</span>
                <span className="font-medium">{selectedPrompt.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Author:</span>
                <span className="font-medium">{selectedPrompt.author}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Usage:</span>
                <span className="font-medium">{selectedPrompt.usage} times</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Modified:</span>
                <span className="font-medium">{new Date(selectedPrompt.lastModified).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Variables</h3>
            <div className="space-y-2">
              {selectedPrompt.variables.map(variable => (
                <div key={variable} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <Code className="h-4 w-4 text-gray-500" />
                  <span className="text-sm font-mono">{variable}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold mb-3">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {selectedPrompt.tags.map(tag => (
                <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderEditor = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          {editingPrompt?.id ? 'Edit Prompt' : 'New Prompt'}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEditor(false)}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            onClick={handleSavePrompt}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            <input
              type="text"
              value={editingPrompt?.name || ''}
              onChange={(e) => setEditingPrompt({...editingPrompt, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter prompt name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={editingPrompt?.description || ''}
              onChange={(e) => setEditingPrompt({...editingPrompt, description: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter prompt description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={editingPrompt?.category || ''}
              onChange={(e) => setEditingPrompt({...editingPrompt, category: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {categories.slice(1).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
            <input
              type="text"
              value={editingPrompt?.tags?.join(', ') || ''}
              onChange={(e) => setEditingPrompt({...editingPrompt, tags: e.target.value.split(', ').filter(t => t)})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter tags separated by commas"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
          <textarea
            value={editingPrompt?.template || ''}
            onChange={(e) => setEditingPrompt({...editingPrompt, template: e.target.value})}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            placeholder="Enter prompt template with {{variables}}"
          />
          <p className="text-xs text-gray-500 mt-2">
            Use {{variable_name}} syntax for template variables
          </p>
        </div>
      </div>
    </div>
  );

  const renderServers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">MCP Server Status</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {servers.map(server => (
          <div key={server.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">{server.name}</h3>
              <div className={`flex items-center gap-2 ${
                server.status === 'healthy' ? 'text-green-600' : 
                server.status === 'degraded' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {server.status === 'healthy' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                <span className="text-sm font-medium capitalize">{server.status}</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Uptime:</span>
                <span className="font-medium">{server.uptime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Requests:</span>
                <span className="font-medium">{server.requests.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Federation Configuration</h3>
        <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "mcpServers": {
    "mcp-prompts": {
      "command": "npx",
      "args": ["-y", "@sparesparrow/mcp-prompts"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/files"]
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"]
    }
  }
}`}
        </pre>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Analytics & Usage</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Prompts</p>
              <p className="text-2xl font-bold text-gray-900">{prompts.length}</p>
            </div>
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Usage</p>
              <p className="text-2xl font-bold text-gray-900">{prompts.reduce((sum, p) => sum + p.usage, 0)}</p>
            </div>
            <Activity className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Servers</p>
              <p className="text-2xl font-bold text-gray-900">{servers.filter(s => s.status === 'healthy').length}</p>
            </div>
            <Server className="h-8 w-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">API Requests</p>
              <p className="text-2xl font-bold text-gray-900">{servers.reduce((sum, s) => sum + s.requests, 0)}</p>
            </div>
            <Zap className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Most Used Prompts</h3>
        <div className="space-y-3">
          {prompts.sort((a, b) => b.usage - a.usage).slice(0, 5).map(prompt => (
            <div key={prompt.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <div>
                <p className="font-medium text-gray-900">{prompt.name}</p>
                <p className="text-sm text-gray-600">{prompt.category}</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-gray-900">{prompt.usage} uses</p>
                <p className="text-sm text-gray-600">v{prompt.version}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Database className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-xl font-bold text-gray-900">MCP Prompts</h1>
                  <p className="text-sm text-gray-600">Server Dashboard</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <Upload className="h-4 w-4" />
                Import
              </button>
              <button className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <Download className="h-4 w-4" />
                Export
              </button>
              <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Settings className="h-4 w-4" />
                Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-8">
            {[
              { id: 'prompts', label: 'Prompts', icon: FileText },
              { id: 'servers', label: 'Servers', icon: Server },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'users', label: 'Users', icon: Users }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'prompts' && (
          showEditor ? renderEditor() : 
          showVersionHistory ? (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Version History</h3>
              <div className="space-y-3">
                {['2.1.0', '2.0.1', '2.0.0', '1.9.3'].map(version => (
                  <div key={version} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <GitBranch className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">v{version}</span>
                      <span className="text-sm text-gray-600">Updated security analysis</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">2 days ago</span>
                      <button className="text-sm text-blue-600 hover:text-blue-800">Restore</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : 
          selectedPrompt ? renderPromptDetail() : renderPromptsList()
        )}
        {activeTab === 'servers' && renderServers()}
        {activeTab === 'analytics' && renderAnalytics()}
        {activeTab === 'users' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">User Management</h2>
            <p className="text-gray-600">User management features coming soon...</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default MCPPromptsDashboard;