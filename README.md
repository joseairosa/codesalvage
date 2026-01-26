# ProjectFinish

> Marketplace for Incomplete Software Projects

![CI Status](https://github.com/YOUR_USERNAME/projectfinish/workflows/CI/badge.svg)
![Deployment](https://img.shields.io/badge/deploy-railway-blueviolet)
![License](https://img.shields.io/badge/license-proprietary-red)

A specialized platform connecting developers who have incomplete projects (50-95% complete) with buyers who want to purchase and finish them.

**Key Features:**

- 🔐 GitHub OAuth authentication
- 💰 Stripe Connect payments with 7-day escrow
- 📦 Project listings with completion tracking (50-95%)
- 💬 Buyer-seller messaging
- ⭐ Reviews and ratings
- 📊 Seller analytics dashboard

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm 10+

### Development Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd recycleai
```

2. **Install dependencies**

```bash
npm install
```

3. **Set up environment variables**

```bash
cp .env.example .env.local
# Edit .env.local with your credentials
```

4. **Start Docker development environment**

```bash
npm run docker:dev
```

This starts:

- Next.js app on http://localhost:3011
- PostgreSQL on localhost:5432
- Redis on localhost:6379

5. **Run database migrations**

```bash
npm run db:migrate
npm run db:seed
```

6. **Open the app**

Navigate to http://localhost:3011

### Alternative: Local Development (without Docker)

If you prefer to run services locally:

```bash
# Start Postgres and Redis manually, then:
npm run dev
```

## 📁 Project Structure

```
projectfinish/
├── app/                    # Next.js 15 App Router pages
├── components/             # React components
│   └── ui/                # Shadcn/ui components
├── lib/                   # Shared utilities
├── services/              # Business logic layer (SRP)
├── repositories/          # Data access layer (Repository Pattern)
├── config/                # Configuration files
├── prisma/                # Database schema and migrations
├── types/                 # TypeScript type definitions
└── public/                # Static assets
```

## 🛠 Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server
npm run docker:dev       # Start Docker environment
npm run docker:down      # Stop Docker environment
npm run docker:logs      # View Docker logs

# Database
npm run db:migrate       # Run Prisma migrations
npm run db:push          # Push schema without migration
npm run db:seed          # Seed database with test data
npm run db:studio        # Open Prisma Studio
npm run db:generate      # Generate Prisma Client

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run format           # Format with Prettier
npm run type-check       # TypeScript type checking

# Testing
npm run test             # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run test:e2e         # Run E2E tests
npm run test:e2e:ui      # Run E2E tests with UI

# Build & Deploy
npm run build            # Build for production
npm run start            # Start production server
```

## 🏗 Architecture

### Service-Oriented Architecture

```
┌─────────────────────────────────────────┐
│  Presentation (React Components)        │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  API Layer (Next.js Route Handlers)     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Service Layer (Business Logic - SRP)   │
│  - AuthService                           │
│  - ProjectService                        │
│  - TransactionService                    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Repository Layer (Data Access)          │
│  - UserRepository                        │
│  - ProjectRepository                     │
│  - TransactionRepository                 │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  Data Layer (Prisma ORM + PostgreSQL)    │
└─────────────────────────────────────────┘
```

### Key Patterns

- **Repository Pattern**: Isolate data access logic
- **Service Pattern**: Encapsulate business logic
- **Dependency Injection**: Services accept dependencies via constructor
- **Single Responsibility**: Each class has one reason to change

## 🧪 Testing

```bash
# Unit Tests (Vitest)
npm run test

# E2E Tests (Playwright)
npm run test:e2e

# Coverage
npm run test:coverage
```

## 🐳 Docker

### Development

```bash
docker-compose up -d
```

### Production Build

```bash
docker build -t projectfinish .
docker run -p 3000:3000 projectfinish
```

## 📚 Tech Stack

- **Framework**: Next.js 15 (App Router, React Server Components)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS + Shadcn/ui
- **Database**: PostgreSQL + Prisma ORM
- **Cache**: Redis
- **Auth**: Auth.js v5 (GitHub OAuth)
- **Payments**: Stripe Connect
- **File Storage**: Cloudflare R2
- **Email**: SendGrid
- **Testing**: Vitest + Playwright
- **Deployment**: Railway

## 📖 Documentation

- [Implementation Plan](/.claude/plans/wiggly-toasting-puffin.md)
- [Business Plan](/ai_docs/plans/000000000001-business-plan.md)
- [Technical Specs](/ai_docs/plans/000000000003-technical-specs.md)
- [GitHub Actions CI/CD Guide](/GITHUB_ACTIONS.md)
- [Railway Deployment Guide](/RAILWAY_DEPLOYMENT.md)

## 🚀 CI/CD Pipeline

This project uses **GitHub Actions** for automated testing and deployment:

### Continuous Integration (CI)

On every push and pull request:

- ✅ **Lint Check** - ESLint and Prettier validation
- ✅ **Type Check** - TypeScript compilation check
- ✅ **Unit Tests** - Vitest tests with coverage
- ✅ **E2E Tests** - Playwright tests across browsers
- ✅ **Build Check** - Next.js production build verification

**All checks must pass before merging to `main`**

### Continuous Deployment (CD)

On merge to `main` branch:

- 🚀 Automated deployment to Railway staging environment
- 📦 Database migrations run automatically
- ✅ Health checks verify deployment success

**See [GITHUB_ACTIONS.md](/GITHUB_ACTIONS.md) for setup instructions.**

## 🤝 Contributing

This is a private project. For questions, contact the maintainers.

## 📄 License

Proprietary and Confidential
