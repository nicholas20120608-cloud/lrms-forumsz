# LRMS Forum - Lufkin Road Middle School

A modern, sleek forum application for students at Lufkin Road Middle School.

## Features

- 🏫 **Student Forum**: Create threads, post replies, and discuss topics
- 👥 **Direct Messaging**: Private conversations between students
- 📷 **Image Sharing**: Upload and share images in posts and messages
- 👑 **Admin Panel**: User management and moderation tools
- 🎨 **Modern UI**: Sleek, intuitive, and friendly design

## Default Admin Account

- **Username**: `admin`
- **Password**: `admin123`

⚠️ **Important**: Change the admin password after first login!

## Railway Deployment

This app is configured for one-click deployment on Railway.

### Quick Deploy

1. Push this repository to GitHub
2. Go to [Railway](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select this repository
5. Click "Deploy" - that's it!

Railway will automatically:
- Detect Node.js
- Install dependencies
- Start the server
- Provide a public URL

### Environment Variables (Optional)

You can set these in Railway's environment variables:
- `PORT`: Server port (auto-set by Railway)
- `SESSION_SECRET`: Session secret key (change for production)
- `NODE_ENV`: Set to `production` for secure cookies

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open http://localhost:3000 in your browser

## Project Structure

```
lrms-forumsz/
├── server.js          # Express server and API routes
├── package.json       # Dependencies
├── public/           # Frontend files
│   ├── index.html    # Main HTML
│   ├── styles.css    # Styling
│   ├── app.js        # Frontend JavaScript
│   └── uploads/      # Image uploads directory
├── forum.db          # SQLite database (created on first run)
└── railway.json      # Railway configuration
```

## Technology Stack

- **Backend**: Node.js, Express
- **Database**: SQLite
- **Frontend**: Vanilla JavaScript, HTML, CSS
- **File Upload**: Multer
- **Authentication**: Express Sessions, bcrypt

## Notes

- The database is created automatically on first run
- Default categories are created automatically
- Images are stored in `public/uploads/`
- Session cookies are secure in production mode
