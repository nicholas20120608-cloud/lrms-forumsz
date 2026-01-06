const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'lrms-forum-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Create uploads directory
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Initialize database
const db = new sqlite3.Database('forum.db');

db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Categories table
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Threads table
  db.run(`CREATE TABLE IF NOT EXISTS threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  // Posts table
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (thread_id) REFERENCES threads(id),
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  // Messages table
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    read INTEGER DEFAULT 0,
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (recipient_id) REFERENCES users(id)
  )`);

  // Create default admin user if it doesn't exist
  db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
    if (!row) {
      const adminPassword = bcrypt.hashSync('admin123', 10);
      db.run("INSERT INTO users (username, email, password, is_admin) VALUES (?, ?, ?, ?)",
        ['admin', 'admin@lrms.edu', adminPassword, 1]);
    }
  });

  // Create default categories
  db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
    if (row && row.count === 0) {
      const defaultCategories = [
        ['General Discussion', 'Talk about anything!'],
        ['Homework Help', 'Get help with your assignments'],
        ['School Events', 'Discuss upcoming events'],
        ['Sports', 'Talk about sports and activities'],
        ['Off Topic', 'Anything goes!']
      ];
      const stmt = db.prepare("INSERT INTO categories (name, description) VALUES (?, ?)");
      defaultCategories.forEach(cat => stmt.run(cat));
      stmt.finalize();
    }
  });
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.session.isAdmin) {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

// API Routes

// Auth routes
app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run("INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
      [username, email, hashedPassword], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Registration failed' });
        }
        req.session.userId = this.lastID;
        req.session.username = username;
        req.session.isAdmin = 0;
        res.json({ success: true, userId: this.lastID, username });
      });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isAdmin = user.is_admin;
    res.json({ success: true, userId: user.id, username: user.username, isAdmin: user.is_admin });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  if (req.session.userId) {
    res.json({
      userId: req.session.userId,
      username: req.session.username,
      isAdmin: req.session.isAdmin
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// Categories
app.get('/api/categories', (req, res) => {
  db.all("SELECT * FROM categories ORDER BY name", (err, categories) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch categories' });
    res.json(categories);
  });
});

// Threads
app.get('/api/threads/:categoryId', (req, res) => {
  const categoryId = req.params.categoryId;
  db.all(`SELECT t.*, u.username as author_name, 
          (SELECT COUNT(*) FROM posts WHERE thread_id = t.id) as post_count,
          (SELECT MAX(created_at) FROM posts WHERE thread_id = t.id) as last_activity
          FROM threads t
          JOIN users u ON t.author_id = u.id
          WHERE t.category_id = ?
          ORDER BY t.updated_at DESC`, [categoryId], (err, threads) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch threads' });
    res.json(threads);
  });
});

app.post('/api/threads', requireAuth, (req, res) => {
  const { categoryId, title } = req.body;
  if (!categoryId || !title) {
    return res.status(400).json({ error: 'Category and title required' });
  }
  db.run("INSERT INTO threads (category_id, title, author_id) VALUES (?, ?, ?)",
    [categoryId, title, req.session.userId], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to create thread' });
      res.json({ success: true, threadId: this.lastID });
    });
});

// Posts
app.get('/api/posts/:threadId', (req, res) => {
  const threadId = req.params.threadId;
  db.all(`SELECT p.*, u.username as author_name
          FROM posts p
          JOIN users u ON p.author_id = u.id
          WHERE p.thread_id = ?
          ORDER BY p.created_at ASC`, [threadId], (err, posts) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch posts' });
    res.json(posts);
  });
});

app.post('/api/posts', requireAuth, upload.single('image'), (req, res) => {
  const { threadId, content } = req.body;
  if (!threadId || !content) {
    return res.status(400).json({ error: 'Thread ID and content required' });
  }
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  db.run("INSERT INTO posts (thread_id, author_id, content, image_url) VALUES (?, ?, ?, ?)",
    [threadId, req.session.userId, content, imageUrl], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to create post' });
      // Update thread updated_at
      db.run("UPDATE threads SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [threadId]);
      res.json({ success: true, postId: this.lastID, imageUrl });
    });
});

// Messages
app.get('/api/messages', requireAuth, (req, res) => {
  const userId = req.session.userId;
  db.all(`SELECT m.*, 
          u1.username as sender_name, 
          u2.username as recipient_name
          FROM messages m
          JOIN users u1 ON m.sender_id = u1.id
          JOIN users u2 ON m.recipient_id = u2.id
          WHERE m.sender_id = ? OR m.recipient_id = ?
          ORDER BY m.created_at DESC`, [userId, userId], (err, messages) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch messages' });
    res.json(messages);
  });
});

app.get('/api/messages/conversation/:userId', requireAuth, (req, res) => {
  const currentUserId = req.session.userId;
  const otherUserId = req.params.userId;
  db.all(`SELECT m.*, u.username as sender_name
          FROM messages m
          JOIN users u ON m.sender_id = u.id
          WHERE (m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?)
          ORDER BY m.created_at ASC`, 
    [currentUserId, otherUserId, otherUserId, currentUserId], (err, messages) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch conversation' });
    // Mark messages as read
    db.run("UPDATE messages SET read = 1 WHERE recipient_id = ? AND sender_id = ?", 
      [currentUserId, otherUserId]);
    res.json(messages);
  });
});

app.post('/api/messages', requireAuth, upload.single('image'), (req, res) => {
  const { recipientId, content } = req.body;
  if (!recipientId || !content) {
    return res.status(400).json({ error: 'Recipient and content required' });
  }
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  db.run("INSERT INTO messages (sender_id, recipient_id, content, image_url) VALUES (?, ?, ?, ?)",
    [req.session.userId, recipientId, content, imageUrl], function(err) {
      if (err) return res.status(500).json({ error: 'Failed to send message' });
      res.json({ success: true, messageId: this.lastID, imageUrl });
    });
});

app.get('/api/users', requireAuth, (req, res) => {
  db.all("SELECT id, username, email, created_at FROM users ORDER BY username", (err, users) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch users' });
    res.json(users);
  });
});

// Admin routes
app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  db.all("SELECT id, username, email, is_admin, created_at FROM users ORDER BY created_at DESC", 
    (err, users) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch users' });
      res.json(users);
    });
});

app.post('/api/admin/users/:userId/toggle-admin', requireAuth, requireAdmin, (req, res) => {
  const userId = req.params.userId;
  db.run("UPDATE users SET is_admin = NOT is_admin WHERE id = ?", [userId], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to update user' });
    res.json({ success: true });
  });
});

app.delete('/api/admin/posts/:postId', requireAuth, requireAdmin, (req, res) => {
  const postId = req.params.postId;
  db.run("DELETE FROM posts WHERE id = ?", [postId], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to delete post' });
    res.json({ success: true });
  });
});

app.delete('/api/admin/threads/:threadId', requireAuth, requireAdmin, (req, res) => {
  const threadId = req.params.threadId;
  db.run("DELETE FROM threads WHERE id = ?", [threadId], (err) => {
    if (err) return res.status(500).json({ error: 'Failed to delete thread' });
    res.json({ success: true });
  });
});

// Serve main page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
