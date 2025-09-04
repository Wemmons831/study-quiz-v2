# Study Quiz V2 - Full Stack Study Platform

A comprehensive study platform with user accounts, public study sets, leaderboards, and progress tracking.

## Features

- 🔐 **User Authentication** - Email/password accounts with profile customization
- 📚 **Study Sets** - Create public or private study sets with CSV import/export
- 🏆 **Leaderboards** - Weekly leaderboards for questions mastered and study time
- 🔍 **Discovery** - Browse popular and recently created public study sets
- 📱 **Zen Mode** - Distraction-free quiz experience
- 🌓 **Dark/Light Theme** - Customizable UI themes
- ⚡ **Real-time Progress** - Accurate study time tracking and progress saving

## Tech Stack

- **Backend**: Node.js, Express, PostgreSQL
- **Frontend**: React, React Router
- **Authentication**: JWT tokens
- **Database**: PostgreSQL with migrations
- **Deployment**: Docker & Docker Compose

## Quick Start

### Prerequisites
- Docker and Docker Compose installed
- Git (to clone the repository)

### Setup & Run

1. **Clone and navigate to project:**
   ```bash
   git clone <your-repo>
   cd study-quiz-v2
   ```

2. **Set up environment variables:**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your settings if needed
   ```

3. **Start the application:**
   ```bash
   docker-compose up --build
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001/api
   - Database: localhost:5432

### Development

- **Backend logs**: `docker-compose logs -f backend`
- **Frontend logs**: `docker-compose logs -f frontend`
- **Database access**: `docker-compose exec postgres psql -U studyquiz -d studyquiz`

## Project Structure

```
study-quiz-v2/
├── docker-compose.yml          # Docker orchestration
├── backend/                    # Node.js/Express API
│   ├── models/                 # Database models
│   ├── routes/                 # API endpoints
│   ├── controllers/            # Business logic
│   ├── middleware/             # Auth, validation, content filtering
│   └── migrations/             # Database schema
└── frontend/                   # React application
    ├── src/components/         # React components
    ├── src/contexts/           # React contexts (auth, theme)
    └── src/services/           # API calls and utilities
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Study Sets
- `GET /api/studysets` - Get user's study sets
- `POST /api/studysets` - Create new study set
- `PUT /api/studysets/:id` - Update study set
- `DELETE /api/studysets/:id` - Delete study set
- `POST /api/studysets/:id/fork` - Fork public study set

### Leaderboards
- `GET /api/leaderboards/questions` - Questions mastered leaderboard
- `GET /api/leaderboards/time` - Study time leaderboard

### Discovery
- `GET /api/discover/popular` - Popular public study sets
- `GET /api/discover/recent` - Recently created public study sets

## Development Notes

- **Study Timer**: Only counts active study time (answering questions within 2 minutes)
- **Leaderboards**: Reset weekly on Sundays at midnight
- **Content Filtering**: Basic profanity filter for usernames and profile pictures
- **Progress Tracking**: Questions need 3 correct answers to be "mastered"

## Stopping the Application

```bash
docker-compose down
```

To remove all data (reset database):
```bash
docker-compose down -v
```

## Production Deployment

1. Update environment variables in backend/.env
2. Change JWT_SECRET to a strong random value
3. Consider using a managed PostgreSQL service
4. Set up proper reverse proxy (nginx) for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with Docker
5. Submit a pull request

## License

MIT License - see LICENSE file for details