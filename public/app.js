// MCP Prompts Frontend Application

class MCPApp {
    constructor() {
        this.apiBase = '';
        this.currentUser = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('loginBtn').addEventListener('click', () => this.showAuthModal('login'));
        document.getElementById('registerBtn').addEventListener('click', () => this.showAuthModal('register'));
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        document.getElementById('getStartedBtn').addEventListener('click', () => this.showAuthModal('register'));

        // Modals
        document.querySelectorAll('.close').forEach(close => {
            close.addEventListener('click', () => this.hideModals());
        });

        // Prompt management
        document.getElementById('createPromptBtn').addEventListener('click', () => this.showPromptModal());

        // Slash commands
        document.getElementById('slashCommandInput').addEventListener('input', (e) => this.handleSlashCommandInput(e.target.value));
        document.getElementById('executeCommandBtn').addEventListener('click', () => this.executeSlashCommand());

        // Search
        document.getElementById('promptSearch').addEventListener('input', () => this.searchPrompts());

        // Forms
        document.getElementById('isTemplate').addEventListener('change', (e) => {
            document.getElementById('variablesGroup').style.display = e.target.checked ? 'block' : 'none';
        });
    }

    async checkAuthStatus() {
        try {
            const response = await this.apiCall('/v1/subscription/status');
            if (response.subscription) {
                this.setAuthenticatedUser(response.subscription);
            } else {
                this.showLandingPage();
            }
        } catch (error) {
            this.showLandingPage();
        }
    }

    showLandingPage() {
        document.getElementById('landingSection').style.display = 'block';
        document.getElementById('dashboardSection').style.display = 'none';
        document.getElementById('navAuth').style.display = 'flex';
        document.getElementById('navUser').style.display = 'none';
    }

    setAuthenticatedUser(subscription) {
        this.currentUser = subscription;
        document.getElementById('landingSection').style.display = 'none';
        document.getElementById('dashboardSection').style.display = 'block';
        document.getElementById('navAuth').style.display = 'none';
        document.getElementById('navUser').style.display = 'flex';

        this.updateSubscriptionStatus(subscription);
        this.loadUserPrompts();
        this.loadPublicPrompts();
        this.loadPricingPlans();
    }

    updateSubscriptionStatus(subscription) {
        const statusEl = document.getElementById('subscriptionStatus');
        const tier = subscription.tier || 'free';

        statusEl.className = `subscription-status ${tier}`;
        statusEl.textContent = `${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`;

        const upgradeSection = document.getElementById('upgradeSection');
        upgradeSection.style.display = tier === 'free' ? 'block' : 'none';
    }

    showAuthModal(mode) {
        const modal = document.getElementById('authModal');
        const content = document.getElementById('authContent');

        content.innerHTML = this.getAuthFormHTML(mode);
        modal.style.display = 'block';

        this.setupAuthForm(mode);
    }

    getAuthFormHTML(mode) {
        const isLogin = mode === 'login';
        return `
            <div class="auth-form">
                <h3>${isLogin ? 'Login' : 'Create Account'}</h3>
                <div class="auth-tabs">
                    <button class="auth-tab ${isLogin ? 'active' : ''}" onclick="app.showAuthModal('login')">Login</button>
                    <button class="auth-tab ${!isLogin ? 'active' : ''}" onclick="app.showAuthModal('register')">Register</button>
                </div>
                <form id="authForm">
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" required minlength="8">
                    </div>
                    ${!isLogin ? `
                        <div class="form-group">
                            <label for="confirmPassword">Confirm Password</label>
                            <input type="password" id="confirmPassword" required minlength="8">
                        </div>
                    ` : ''}
                    <div id="authMessage"></div>
                    <button type="submit" class="btn btn-primary" style="width: 100%;">
                        ${isLogin ? 'Login' : 'Create Account'}
                    </button>
                </form>
            </div>
        `;
    }

    setupAuthForm(mode) {
        const form = document.getElementById('authForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAuth(mode);
        });
    }

    async handleAuth(mode) {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const messageEl = document.getElementById('authMessage');

        try {
            messageEl.innerHTML = '<div class="loading">Processing...</div>';

            const endpoint = mode === 'login' ? '/auth' : '/auth';
            const body = { action: mode, email, password };

            if (mode === 'register') {
                const confirmPassword = document.getElementById('confirmPassword').value;
                if (password !== confirmPassword) {
                    throw new Error('Passwords do not match');
                }
            }

            const response = await this.apiCall(endpoint, 'POST', body);

            if (response.success) {
                // Store auth token (simplified - in production use proper JWT handling)
                localStorage.setItem('authToken', response.data.accessToken);
                this.hideModals();
                this.checkAuthStatus();
            } else {
                throw new Error(response.message);
            }
        } catch (error) {
            messageEl.innerHTML = `<div class="error-message">${error.message}</div>`;
        }
    }

    async logout() {
        localStorage.removeItem('authToken');
        this.currentUser = null;
        this.showLandingPage();
    }

    showPromptModal(prompt = null) {
        const modal = document.getElementById('promptModal');
        const title = document.getElementById('promptModalTitle');
        const form = document.getElementById('promptForm');

        title.textContent = prompt ? 'Edit Prompt' : 'Create New Prompt';

        if (prompt) {
            document.getElementById('promptName').value = prompt.name || '';
            document.getElementById('promptContent').value = prompt.content || '';
            document.getElementById('promptCategory').value = prompt.category || 'general';
            document.getElementById('promptTags').value = (prompt.tags || []).join(', ');
            document.getElementById('isTemplate').checked = prompt.isTemplate || false;
            document.getElementById('promptVariables').value = JSON.stringify(prompt.variables || {}, null, 2);
        } else {
            form.reset();
        }

        modal.style.display = 'block';

        form.onsubmit = (e) => {
            e.preventDefault();
            this.savePrompt(prompt?.id);
        };
    }

    async savePrompt(promptId = null) {
        try {
            const data = {
                name: document.getElementById('promptName').value,
                content: document.getElementById('promptContent').value,
                category: document.getElementById('promptCategory').value,
                tags: document.getElementById('promptTags').value.split(',').map(tag => tag.trim()).filter(tag => tag),
                isTemplate: document.getElementById('isTemplate').checked,
                variables: document.getElementById('isTemplate').checked ?
                    JSON.parse(document.getElementById('promptVariables').value || '{}') : []
            };

            const response = await this.apiCall(
                promptId ? `/v1/prompts/${promptId}` : '/v1/prompts',
                promptId ? 'PUT' : 'POST',
                data
            );

            if (response.success) {
                this.hideModals();
                this.loadUserPrompts();
                this.showMessage('Prompt saved successfully!', 'success');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    async loadUserPrompts() {
        try {
            const response = await this.apiCall('/users/me/prompts');
            const container = document.getElementById('userPrompts');

            if (response.prompts && response.prompts.length > 0) {
                container.innerHTML = response.prompts.map(prompt => `
                    <div class="prompt-item">
                        <h4>${prompt.name}</h4>
                        <div class="prompt-meta">
                            Category: ${prompt.category} | Tags: ${(prompt.tags || []).join(', ')}
                        </div>
                        <div class="prompt-actions">
                            <button class="btn btn-secondary" onclick="app.showPromptModal(${JSON.stringify(prompt).replace(/"/g, '&quot;')})">Edit</button>
                            <button class="btn btn-secondary" onclick="app.deletePrompt('${prompt.id}')">Delete</button>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p>You haven\'t created any prompts yet.</p>';
            }
        } catch (error) {
            document.getElementById('userPrompts').innerHTML = '<p>Error loading prompts.</p>';
        }
    }

    async loadPublicPrompts() {
        try {
            const response = await this.apiCall('/v1/prompts?limit=20');
            const container = document.getElementById('publicPrompts');

            if (response.prompts && response.prompts.length > 0) {
                container.innerHTML = response.prompts.map(prompt => `
                    <div class="prompt-item">
                        <h4>${prompt.name}</h4>
                        <div class="prompt-meta">
                            Category: ${prompt.category} | Access: ${prompt.accessLevel}
                        </div>
                        <div class="prompt-actions">
                            <button class="btn btn-secondary" onclick="app.applyPrompt('${prompt.id}')">Use</button>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p>No prompts available.</p>';
            }
        } catch (error) {
            document.getElementById('publicPrompts').innerHTML = '<p>Error loading prompts.</p>';
        }
    }

    async searchPrompts() {
        const query = document.getElementById('promptSearch').value;
        const category = document.getElementById('categoryFilter').value;

        try {
            let url = '/v1/prompts?';
            if (query) url += `q=${encodeURIComponent(query)}&`;
            if (category) url += `category=${encodeURIComponent(category)}&`;

            const response = await this.apiCall(url);
            const container = document.getElementById('publicPrompts');

            if (response.prompts && response.prompts.length > 0) {
                container.innerHTML = response.prompts.map(prompt => `
                    <div class="prompt-item">
                        <h4>${prompt.name}</h4>
                        <div class="prompt-meta">
                            Category: ${prompt.category} | Access: ${prompt.accessLevel}
                        </div>
                        <div class="prompt-actions">
                            <button class="btn btn-secondary" onclick="app.applyPrompt('${prompt.id}')">Use</button>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p>No prompts found matching your search.</p>';
            }
        } catch (error) {
            document.getElementById('publicPrompts').innerHTML = '<p>Error searching prompts.</p>';
        }
    }

    async handleSlashCommandInput(value) {
        if (!value.startsWith('/')) return;

        try {
            const response = await this.apiCall(`/v1/slash-commands/suggest?q=${encodeURIComponent(value)}`);
            const suggestionsEl = document.getElementById('commandSuggestions');

            if (response.suggestions && response.suggestions.length > 0) {
                suggestionsEl.innerHTML = response.suggestions.map(cmd => `
                    <div class="command-suggestion" onclick="app.selectCommand('${cmd.command}')">
                        <strong>${cmd.command}</strong> - ${cmd.description}
                    </div>
                `).join('');
            } else {
                suggestionsEl.innerHTML = '';
            }
        } catch (error) {
            console.error('Error getting command suggestions:', error);
        }
    }

    selectCommand(command) {
        document.getElementById('slashCommandInput').value = command;
        document.getElementById('commandSuggestions').innerHTML = '';
    }

    async executeSlashCommand() {
        const command = document.getElementById('slashCommandInput').value;
        if (!command) return;

        try {
            const response = await this.apiCall('/v1/slash-commands/execute', 'POST', {
                command,
                variables: {} // Could be enhanced to parse variables from command
            });

            document.getElementById('commandResult').innerHTML = `
                <h4>Command Result:</h4>
                <pre>${response.result}</pre>
            `;
        } catch (error) {
            document.getElementById('commandResult').innerHTML = `
                <div class="error-message">Error executing command: ${error.message}</div>
            `;
        }
    }

    async loadPricingPlans() {
        try {
            const response = await this.apiCall('/v1/subscription/plans');
            const container = document.getElementById('pricingPlans');

            if (response.plans && response.plans.length > 0) {
                container.innerHTML = response.plans.map(plan => `
                    <div class="pricing-plan ${plan.id.includes('premium') ? 'premium' : ''}">
                        <h4>${plan.name}</h4>
                        <div class="price">$${(plan.price / 100).toFixed(2)}</div>
                        <p>per ${plan.interval}</p>
                        <ul class="features">
                            ${plan.features.map(feature => `<li>${feature}</li>`).join('')}
                        </ul>
                        <button class="btn btn-primary" onclick="app.upgradeToPlan('${plan.id}')">
                            Upgrade
                        </button>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Error loading pricing plans:', error);
        }
    }

    async upgradeToPlan(planId) {
        try {
            // Create payment intent
            const intentResponse = await this.apiCall('/v1/payment/create-intent', 'POST', { planId });
            // In a real implementation, this would integrate with Stripe Elements
            // For demo purposes, we'll simulate the upgrade
            alert('Payment integration would be implemented here with Stripe Elements');
        } catch (error) {
            this.showMessage(error.message, 'error');
        }
    }

    async apiCall(endpoint, method = 'GET', body = null) {
        const headers = {
            'Content-Type': 'application/json',
        };

        const token = localStorage.getItem('authToken');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            method,
            headers,
        };

        if (body) {
            config.body = JSON.stringify(body);
        }

        const response = await fetch(`${this.apiBase}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'API call failed');
        }

        return data;
    }

    hideModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    showMessage(message, type = 'info') {
        // Simple message display - could be enhanced with toast notifications
        const messageEl = document.createElement('div');
        messageEl.className = type === 'error' ? 'error-message' : 'success-message';
        messageEl.textContent = message;
        messageEl.style.position = 'fixed';
        messageEl.style.top = '20px';
        messageEl.style.right = '20px';
        messageEl.style.zIndex = '1001';
        messageEl.style.maxWidth = '400px';

        document.body.appendChild(messageEl);
        setTimeout(() => document.body.removeChild(messageEl), 5000);
    }
}

// Initialize app
const app = new MCPApp();
window.app = app;