// API configuration
const API_BASE = window.location.origin;
let authToken = localStorage.getItem('authToken');
let userInfo = null;

// DOM elements
const welcomeSection = document.getElementById('welcome');
const dashboard = document.getElementById('dashboard');
const promptsList = document.getElementById('promptsList');
const promptDetail = document.getElementById('promptDetail');
const slashCommandResult = document.getElementById('slashCommandResult');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    if (authToken) {
        showDashboard();
        loadUserInfo();
    } else {
        showWelcome();
    }

    // Form handlers
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('uploadForm').addEventListener('submit', handleUpload);
});

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(`${API_BASE}/auth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'login',
                email,
                password
            })
        });

        const data = await response.json();

        if (data.success) {
            authToken = data.data.accessToken;
            localStorage.setItem('authToken', authToken);
            closeModal('loginModal');
            showDashboard();
            loadUserInfo();
        } else {
            alert(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed');
    }
}

async function handleRegister(e) {
    e.preventDefault();

    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const response = await fetch(`${API_BASE}/auth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'register',
                email,
                password
            })
        });

        const data = await response.json();

        if (data.success) {
            authToken = data.data.accessToken;
            localStorage.setItem('authToken', authToken);
            closeModal('registerModal');
            showDashboard();
            loadUserInfo();
        } else {
            alert(data.message || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed');
    }
}

function logout() {
    authToken = null;
    userInfo = null;
    localStorage.removeItem('authToken');
    showWelcome();
}

// UI functions
function showWelcome() {
    welcomeSection.style.display = 'block';
    dashboard.style.display = 'none';
    document.getElementById('nav').innerHTML = `
        <button id="loginBtn" onclick="showLoginModal()">Login</button>
        <button id="registerBtn" onclick="showRegisterModal()">Register</button>
    `;
}

function showDashboard() {
    welcomeSection.style.display = 'none';
    dashboard.style.display = 'block';
    document.getElementById('nav').innerHTML = `
        <button id="userMenu" onclick="toggleUserMenu()">
            <span id="userEmail">Loading...</span>
        </button>
        <div id="userDropdown" class="dropdown-menu">
            <a href="#" onclick="showProfile()">Profile</a>
            <a href="#" onclick="showSubscription()">Subscription</a>
            <a href="#" onclick="logout()">Logout</a>
        </div>
    `;
    loadPrompts();
}

function showLoginModal() {
    document.getElementById('loginModal').style.display = 'block';
}

function showRegisterModal() {
    document.getElementById('registerModal').style.display = 'block';
}

function showUploadModal() {
    document.getElementById('uploadModal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function toggleUserMenu() {
    const dropdown = document.getElementById('userDropdown');
    dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

// API functions
async function loadUserInfo() {
    try {
        const response = await fetch(`${API_BASE}/users/${getUserId()}/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();
        if (data.success) {
            userInfo = data.data;
            document.getElementById('userEmail').textContent = userInfo.email;
            updateUIForSubscription();
        }
    } catch (error) {
        console.error('Failed to load user info:', error);
    }
}

function updateUIForSubscription() {
    const isPremium = userInfo?.subscriptionTier === 'premium';

    // Show/hide premium features
    document.getElementById('myPromptsBtn').style.display = isPremium ? 'block' : 'none';
    document.getElementById('uploadBtn').style.display = isPremium ? 'block' : 'none';
}

async function loadPrompts() {
    try {
        const response = await fetch(`${API_BASE}/v1/prompts?limit=20`, {
            headers: authToken ? {
                'Authorization': `Bearer ${authToken}`
            } : {}
        });

        const data = await response.json();
        if (data.success) {
            displayPrompts(data.prompts);
        }
    } catch (error) {
        console.error('Failed to load prompts:', error);
    }
}

function displayPrompts(prompts) {
    promptsList.innerHTML = '';

    if (prompts.length === 0) {
        promptsList.innerHTML = '<p>No prompts available.</p>';
        return;
    }

    prompts.forEach(prompt => {
        const card = document.createElement('div');
        card.className = 'prompt-card';
        card.innerHTML = `
            <h4>${prompt.name}</h4>
            <p>${prompt.description || 'No description'}</p>
            <div class="prompt-tags">
                ${prompt.tags?.map(tag => `<span class="tag">${tag}</span>`).join('') || ''}
            </div>
            <div class="prompt-actions">
                <button class="btn-primary" onclick="viewPrompt('${prompt.id}')">View</button>
                <button class="btn-secondary" onclick="applyPrompt('${prompt.id}')">Apply</button>
            </div>
        `;
        promptsList.appendChild(card);
    });

    promptsList.style.display = 'grid';
    promptDetail.style.display = 'none';
    slashCommandResult.style.display = 'none';
}

async function viewPrompt(promptId) {
    try {
        const response = await fetch(`${API_BASE}/v1/prompts/${promptId}`, {
            headers: authToken ? {
                'Authorization': `Bearer ${authToken}`
            } : {}
        });

        const data = await response.json();
        if (data.success) {
            displayPromptDetail(data.data.prompt);
        }
    } catch (error) {
        console.error('Failed to load prompt:', error);
    }
}

function displayPromptDetail(prompt) {
    document.getElementById('promptTitle').textContent = prompt.name;
    document.getElementById('promptContent').textContent = prompt.content;

    if (prompt.variables && prompt.variables.length > 0) {
        const variablesHtml = prompt.variables.map(variable =>
            `<div class="variable-input">
                <label>${variable.name}</label>
                <input type="text" id="var_${variable.name}" placeholder="${variable.description || ''}" ${variable.required ? 'required' : ''}>
            </div>`
        ).join('');

        document.getElementById('promptVariables').innerHTML = `
            <h4>Variables</h4>
            ${variablesHtml}
            <button class="btn-primary" onclick="applyWithVariables('${prompt.id}')">Apply with Variables</button>
        `;
    } else {
        document.getElementById('promptVariables').innerHTML = '';
    }

    promptsList.style.display = 'none';
    promptDetail.style.display = 'block';
    slashCommandResult.style.display = 'none';
}

async function applyPrompt(promptId) {
    try {
        const response = await fetch(`${API_BASE}/v1/prompts/${promptId}/apply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            }
        });

        const data = await response.json();
        if (data.success) {
            displayCommandResult(data.data.result);
        }
    } catch (error) {
        console.error('Failed to apply prompt:', error);
    }
}

async function applyWithVariables(promptId) {
    const variables = {};
    document.querySelectorAll('#promptVariables input').forEach(input => {
        const varName = input.id.replace('var_', '');
        variables[varName] = input.value;
    });

    try {
        const response = await fetch(`${API_BASE}/v1/prompts/${promptId}/apply`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            },
            body: JSON.stringify({ variables })
        });

        const data = await response.json();
        if (data.success) {
            displayCommandResult(data.data.result);
        }
    } catch (error) {
        console.error('Failed to apply prompt with variables:', error);
    }
}

function displayCommandResult(result) {
    document.getElementById('commandOutput').textContent = result;

    promptsList.style.display = 'none';
    promptDetail.style.display = 'none';
    slashCommandResult.style.display = 'block';
}

// Slash commands
function suggestCommands() {
    const input = document.getElementById('commandInput').value;
    const suggestions = document.getElementById('commandSuggestions');

    if (input.length < 2) {
        suggestions.innerHTML = '';
        return;
    }

    // This would call the API for suggestions
    // For now, show some example suggestions
    const exampleCommands = [
        { command: '/code-review', description: 'Review code for best practices' },
        { command: '/bug-analyzer', description: 'Analyze bug reports' },
        { command: '/documentation', description: 'Generate documentation' }
    ].filter(cmd => cmd.command.includes(input) || cmd.description.includes(input));

    suggestions.innerHTML = exampleCommands.map(cmd =>
        `<div class="suggestion-item" onclick="executeCommand('${cmd.command}')">
            <strong>${cmd.command}</strong><br>
            <small>${cmd.description}</small>
        </div>`
    ).join('');
}

async function executeCommand(command) {
    document.getElementById('commandInput').value = command;

    try {
        const response = await fetch(`${API_BASE}/v1/slash-commands/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {})
            },
            body: JSON.stringify({ command })
        });

        const data = await response.json();
        if (data.success) {
            displayCommandResult(data.result);
        }
    } catch (error) {
        console.error('Failed to execute command:', error);
    }
}

// Upload functions
async function handleUpload(e) {
    e.preventDefault();

    if (!authToken) {
        alert('You must be logged in to upload prompts');
        return;
    }

    const formData = {
        name: document.getElementById('promptName').value,
        content: document.getElementById('promptContent').value,
        category: document.getElementById('promptCategory').value,
        tags: document.getElementById('promptTags').value.split(',').map(tag => tag.trim()),
        isTemplate: document.getElementById('isTemplate').checked
    };

    try {
        const response = await fetch(`${API_BASE}/v1/prompts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        if (data.success) {
            alert('Prompt uploaded successfully!');
            closeModal('uploadModal');
            loadPrompts();
        } else {
            alert(data.error || 'Upload failed');
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Upload failed');
    }
}

// Utility functions
function getUserId() {
    // Extract user ID from JWT token (simplified)
    if (!authToken) return null;
    try {
        const payload = JSON.parse(atob(authToken.split('.')[1]));
        return payload.sub || payload.userId;
    } catch (e) {
        return null;
    }
}

function showProfile() {
    // TODO: Implement profile view
    alert('Profile view coming soon!');
}

function showSubscription() {
    document.getElementById('subscriptionModal').style.display = 'block';
    loadSubscriptionPlans();
}

async function loadSubscriptionPlans() {
    try {
        const response = await fetch(`${API_BASE}/v1/subscription/plans`);
        const data = await response.json();

        if (data.success) {
            displaySubscriptionPlans(data.plans);
        }
    } catch (error) {
        console.error('Failed to load plans:', error);
    }
}

function displaySubscriptionPlans(plans) {
    const plansList = document.getElementById('plansList');
    plansList.innerHTML = plans.map(plan => `
        <div class="plan-card">
            <h4>${plan.name}</h4>
            <div class="plan-price">$${plan.price / 100}/${plan.interval}</div>
            <ul class="plan-features">
                ${plan.features.map(feature => `<li>${feature}</li>`).join('')}
            </ul>
            <button class="btn-primary" onclick="subscribeToPlan('${plan.id}')">
                ${plan.id === 'free' ? 'Current Plan' : 'Subscribe'}
            </button>
        </div>
    `).join('');
}

function subscribeToPlan(planId) {
    if (planId === 'free') return;

    // TODO: Implement Stripe checkout
    alert(`Subscription to ${planId} coming soon!`);
}

function showMyPrompts() {
    // TODO: Implement user's prompts view
    alert('My Prompts view coming soon!');
}