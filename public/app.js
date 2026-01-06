let currentUser = null;
let currentCategoryId = null;
let currentThreadId = null;
let currentConversationUserId = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadCategories();
});

// Auth functions
async function checkAuth() {
    try {
        const response = await fetch('/api/me', {
            credentials: 'include'
        });
        if (response.ok) {
            const user = await response.json();
            currentUser = user;
            updateUIForUser(user);
        } else {
            showView('home');
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

function updateUIForUser(user) {
    document.getElementById('authButtons').style.display = 'none';
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('usernameDisplay').textContent = `👤 ${user.username}`;
    
    if (user.isAdmin) {
        document.getElementById('adminLink').style.display = 'inline';
    }
    document.getElementById('messagesLink').style.display = 'inline';
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            credentials: 'include'
        });
        
        const data = await response.json();
        if (response.ok) {
            currentUser = data;
            updateUIForUser(data);
            showToast('Welcome back!', 'success');
            showView('home');
            loadCategories();
        } else {
            showToast(data.error || 'Login failed', 'error');
        }
    } catch (error) {
        showToast('Login failed', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
            credentials: 'include'
        });
        
        const data = await response.json();
        if (response.ok) {
            currentUser = data;
            updateUIForUser(data);
            showToast('Account created! Welcome!', 'success');
            showView('home');
            loadCategories();
        } else {
            showToast(data.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showToast('Registration failed', 'error');
    }
}

async function logout() {
    try {
        await fetch('/api/logout', { 
            method: 'POST',
            credentials: 'include'
        });
        currentUser = null;
        document.getElementById('authButtons').style.display = 'flex';
        document.getElementById('userInfo').style.display = 'none';
        document.getElementById('adminLink').style.display = 'none';
        document.getElementById('messagesLink').style.display = 'none';
        showView('home');
        showToast('Logged out successfully', 'success');
    } catch (error) {
        showToast('Logout failed', 'error');
    }
}

// View management
function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById(viewName + 'View').style.display = 'block';
    
    if (viewName === 'home') {
        loadCategories();
    } else if (viewName === 'messages') {
        loadConversations();
    } else if (viewName === 'admin') {
        loadAdminUsers();
    }
}

// Categories
async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        const categories = await response.json();
        const container = document.getElementById('categoriesContainer');
        
        container.innerHTML = categories.map(cat => `
            <div class="category-card" onclick="loadThreads(${cat.id}, '${cat.name}')">
                <h3>${cat.name}</h3>
                <p>${cat.description || 'Discuss topics related to this category'}</p>
            </div>
        `).join('');
        
        document.getElementById('threadsContainer').style.display = 'none';
        document.getElementById('postsContainer').style.display = 'none';
    } catch (error) {
        showToast('Failed to load categories', 'error');
    }
}

// Threads
async function loadThreads(categoryId, categoryName) {
    currentCategoryId = categoryId;
    try {
        const response = await fetch(`/api/threads/${categoryId}`);
        const threads = await response.json();
        
        document.getElementById('categoriesContainer').style.display = 'none';
        document.getElementById('threadsContainer').style.display = 'block';
        document.getElementById('threadsTitle').textContent = categoryName;
        
        const container = document.getElementById('threadsList');
        if (threads.length === 0) {
            container.innerHTML = '<p class="empty-state">No threads yet. Be the first to start one!</p>';
        } else {
            container.innerHTML = threads.map(thread => `
                <div class="thread-card" onclick="loadPosts(${thread.id}, '${thread.title.replace(/'/g, "\\'")}')">
                    <h3>${thread.title}</h3>
                    <div class="thread-meta">
                        <span>By ${thread.author_name}</span>
                        <span>${thread.post_count} posts</span>
                        <span>${formatDate(thread.last_activity || thread.created_at)}</span>
                    </div>
                </div>
            `).join('');
        }
        
        if (currentUser) {
            container.innerHTML += `
                <div style="margin-top: 2rem;">
                    <button onclick="showNewThreadForm()" class="btn btn-primary">+ New Thread</button>
                    <div id="newThreadForm" style="display:none; margin-top: 1rem;">
                        <input type="text" id="newThreadTitle" placeholder="Thread title" style="width: 100%; padding: 1rem; border: 2px solid var(--border-color); border-radius: 8px; margin-bottom: 1rem;">
                        <button onclick="createThread()" class="btn btn-primary">Create Thread</button>
                        <button onclick="hideNewThreadForm()" class="btn btn-secondary">Cancel</button>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        showToast('Failed to load threads', 'error');
    }
}

function showNewThreadForm() {
    document.getElementById('newThreadForm').style.display = 'block';
}

function hideNewThreadForm() {
    document.getElementById('newThreadForm').style.display = 'none';
}

async function createThread() {
    const title = document.getElementById('newThreadTitle').value;
    if (!title) {
        showToast('Please enter a thread title', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/threads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ categoryId: currentCategoryId, title }),
            credentials: 'include'
        });
        
        const data = await response.json();
        if (response.ok) {
            showToast('Thread created!', 'success');
            loadThreads(currentCategoryId, document.getElementById('threadsTitle').textContent);
            hideNewThreadForm();
        } else {
            showToast(data.error || 'Failed to create thread', 'error');
        }
    } catch (error) {
        showToast('Failed to create thread', 'error');
    }
}

function goBackToThreads() {
    document.getElementById('postsContainer').style.display = 'none';
    document.getElementById('threadsContainer').style.display = 'block';
}

// Posts
async function loadPosts(threadId, threadTitle) {
    currentThreadId = threadId;
    try {
        const response = await fetch(`/api/posts/${threadId}`);
        const posts = await response.json();
        
        document.getElementById('threadsContainer').style.display = 'none';
        document.getElementById('postsContainer').style.display = 'block';
        document.getElementById('postsTitle').textContent = threadTitle;
        
        const container = document.getElementById('postsList');
        container.innerHTML = posts.map(post => `
            <div class="post-card">
                <div class="post-header">
                    <span class="post-author">${post.author_name}</span>
                    <span class="post-date">${formatDate(post.created_at)}</span>
                </div>
                <div class="post-content">${escapeHtml(post.content)}</div>
                ${post.image_url ? `<img src="${post.image_url}" alt="Post image" class="post-image">` : ''}
            </div>
        `).join('');
        
        if (currentUser) {
            document.getElementById('postFormContainer').style.display = 'block';
        } else {
            document.getElementById('postFormContainer').style.display = 'none';
        }
        
        container.scrollTop = container.scrollHeight;
    } catch (error) {
        showToast('Failed to load posts', 'error');
    }
}

async function handlePostSubmit(e) {
    e.preventDefault();
    if (!currentUser) {
        showToast('Please login to post', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('threadId', currentThreadId);
    formData.append('content', document.getElementById('postContent').value);
    const imageFile = document.getElementById('postImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    try {
        const response = await fetch('/api/posts', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        const data = await response.json();
        if (response.ok) {
            showToast('Post submitted!', 'success');
            document.getElementById('postForm').reset();
            document.getElementById('postImageName').textContent = '';
            loadPosts(currentThreadId, document.getElementById('postsTitle').textContent);
        } else {
            showToast(data.error || 'Failed to submit post', 'error');
        }
    } catch (error) {
        showToast('Failed to submit post', 'error');
    }
}

document.getElementById('postImage')?.addEventListener('change', (e) => {
    const fileName = e.target.files[0]?.name;
    document.getElementById('postImageName').textContent = fileName || '';
});

// Messages
async function loadConversations() {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/messages', {
            credentials: 'include'
        });
        const messages = await response.json();
        const users = await fetch('/api/users', {
            credentials: 'include'
        }).then(r => r.json());
        
        // Group messages by conversation partner
        const conversations = new Map();
        messages.forEach(msg => {
            const partnerId = msg.sender_id === currentUser.userId ? msg.recipient_id : msg.sender_id;
            const partnerName = msg.sender_id === currentUser.userId ? msg.recipient_name : msg.sender_name;
            if (!conversations.has(partnerId)) {
                conversations.set(partnerId, {
                    userId: partnerId,
                    username: partnerName,
                    lastMessage: msg,
                    unread: msg.recipient_id === currentUser.userId && !msg.read
                });
            }
        });
        
        const container = document.getElementById('conversationsList');
        if (conversations.size === 0) {
            container.innerHTML = '<p class="empty-state">No conversations yet</p>';
        } else {
            container.innerHTML = Array.from(conversations.values()).map(conv => `
                <div class="conversation-item" onclick="loadConversation(${conv.userId}, '${conv.username}')">
                    <strong>${conv.username}</strong>
                    ${conv.unread ? '<span style="color: var(--primary-color);">●</span>' : ''}
                </div>
            `).join('');
        }
    } catch (error) {
        showToast('Failed to load conversations', 'error');
    }
}

async function loadConversation(userId, username) {
    currentConversationUserId = userId;
    try {
        const response = await fetch(`/api/messages/conversation/${userId}`, {
            credentials: 'include'
        });
        const messages = await response.json();
        
        const container = document.getElementById('messagesContent');
        container.innerHTML = `
            <h3>Conversation with ${username}</h3>
            <div class="messages-content" id="messagesList">
                ${messages.map(msg => `
                    <div class="message ${msg.sender_id === currentUser.userId ? 'sent' : 'received'}">
                        <div><strong>${msg.sender_name}</strong></div>
                        <div>${escapeHtml(msg.content)}</div>
                        ${msg.image_url ? `<img src="${msg.image_url}" alt="Message image" class="message-image">` : ''}
                        <div style="font-size: 0.8rem; margin-top: 0.5rem; opacity: 0.8;">${formatDate(msg.created_at)}</div>
                    </div>
                `).join('')}
            </div>
            <form class="message-form" onsubmit="sendMessage(event)">
                <textarea id="messageContent" placeholder="Type your message..." required></textarea>
                <label for="messageImage" class="file-label">📷</label>
                <input type="file" id="messageImage" name="image" accept="image/*">
                <button type="submit" class="btn btn-primary">Send</button>
            </form>
        `;
        
        document.getElementById('messageImage').addEventListener('change', (e) => {
            // Handle image selection
        });
        
        const messagesList = document.getElementById('messagesList');
        messagesList.scrollTop = messagesList.scrollHeight;
    } catch (error) {
        showToast('Failed to load conversation', 'error');
    }
}

async function sendMessage(e) {
    e.preventDefault();
    if (!currentConversationUserId) return;
    
    const formData = new FormData();
    formData.append('recipientId', currentConversationUserId);
    formData.append('content', document.getElementById('messageContent').value);
    const imageFile = document.getElementById('messageImage').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    try {
        const response = await fetch('/api/messages', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        const data = await response.json();
        if (response.ok) {
            document.getElementById('messageContent').value = '';
            document.getElementById('messageImage').value = '';
            loadConversation(currentConversationUserId, 'User');
        } else {
            showToast(data.error || 'Failed to send message', 'error');
        }
    } catch (error) {
        showToast('Failed to send message', 'error');
    }
}

function showNewMessage() {
    // Show user selection for new message
    fetch('/api/users', {
        credentials: 'include'
    })
        .then(r => r.json())
        .then(users => {
            const otherUsers = users.filter(u => u.id !== currentUser.userId);
            const userList = otherUsers.map(u => 
                `<div class="conversation-item" onclick="loadConversation(${u.id}, '${u.username}')">${u.username}</div>`
            ).join('');
            document.getElementById('messagesContent').innerHTML = `
                <h3>Start a new conversation</h3>
                <div>${userList}</div>
            `;
        });
}

// Admin
async function loadAdminUsers() {
    try {
        const response = await fetch('/api/admin/users', {
            credentials: 'include'
        });
        const users = await response.json();
        
        const container = document.getElementById('adminUsersList');
        container.innerHTML = users.map(user => `
            <div class="admin-user-item">
                <div>
                    <strong>${user.username}</strong> (${user.email})
                    ${user.is_admin ? '<span style="color: var(--primary-color);">👑 Admin</span>' : ''}
                </div>
                <button onclick="toggleAdmin(${user.id})" class="btn btn-secondary">
                    ${user.is_admin ? 'Remove Admin' : 'Make Admin'}
                </button>
            </div>
        `).join('');
    } catch (error) {
        showToast('Failed to load users', 'error');
    }
}

async function toggleAdmin(userId) {
    try {
        const response = await fetch(`/api/admin/users/${userId}/toggle-admin`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (response.ok) {
            showToast('User updated', 'success');
            loadAdminUsers();
        } else {
            showToast('Failed to update user', 'error');
        }
    } catch (error) {
        showToast('Failed to update user', 'error');
    }
}

function showAdminTab(tab) {
    document.querySelectorAll('.admin-tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(`admin${tab.charAt(0).toUpperCase() + tab.slice(1)}Tab`).style.display = 'block';
    event.target.classList.add('active');
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
