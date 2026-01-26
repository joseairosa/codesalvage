# TECHNICAL SPECIFICATIONS - PROJECTFINISH MVP

## 1. SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────┐
│                      PROJECTFINISH PLATFORM                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐         ┌──────────────────────────────┐   │
│  │   FRONTEND       │         │   BACKEND API                │   │
│  │ (Next.js + TS)   │◄────────►  (Node.js / Express)         │   │
│  │ - Project Cards  │  HTTP   │  - Auth (JWT)                │   │
│  │ - Search/Filter  │  REST   │  - Project CRUD              │   │
│  │ - Payment UI     │  GraphQL │  - Transaction Logic         │   │
│  │ - Dashboards     │ (optional)│  - Messaging                │   │
│  └──────────────────┘         │  - Reviews                   │   │
│         │                      └──────────────────────────────┘   │
│         │                                  │                      │
│         │                                  ▼                      │
│         │                       ┌──────────────────┐              │
│         │                       │   PostgreSQL DB  │              │
│         │                       │  - Users         │              │
│         │                       │  - Projects      │              │
│         │                       │  - Transactions  │              │
│         │                       │  - Messages      │              │
│         │                       │  - Reviews       │              │
│         │                       └──────────────────┘              │
│         │                                                         │
│         ├──────────────────────┬──────────────────┬─────────────┤
│         ▼                      ▼                  ▼              │
│   ┌──────────────┐    ┌──────────────┐   ┌────────────────┐   │
│   │ Stripe API   │    │ GitHub OAuth │   │ AWS S3 / CDN   │   │
│   │ (Payments)   │    │ (Login)      │   │ (Code Files)   │   │
│   └──────────────┘    └──────────────┘   └────────────────┘   │
│                                                                   │
│         ┌────────────────────────┐                              │
│         │ SendGrid / Mailgun     │                              │
│         │ (Transactional Email)  │                              │
│         └────────────────────────┘                              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 2. DATABASE SCHEMA (PostgreSQL)

### Core Tables

```sql
-- USERS TABLE
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  username VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  bio TEXT,
  avatar_url VARCHAR(500),

  -- User role flags
  is_seller BOOLEAN DEFAULT false,
  is_buyer BOOLEAN DEFAULT true,

  -- GitHub OAuth
  github_id VARCHAR(100),
  github_username VARCHAR(100),
  github_avatar_url VARCHAR(500),

  -- Seller specific
  payout_method VARCHAR(50), -- 'stripe', 'paypal', 'bank_transfer'
  payout_email VARCHAR(255),
  tax_id VARCHAR(100),

  -- Seller verification
  is_verified_seller BOOLEAN DEFAULT false,
  seller_verification_date TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP,

  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_github_id ON users(github_id);
CREATE INDEX idx_users_is_seller ON users(is_seller);

-- PROJECTS TABLE
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,

  completion_percentage INT NOT NULL CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  estimated_completion_hours INT,
  known_issues TEXT,

  price_cents INT NOT NULL CHECK (price_cents > 0),

  license_type VARCHAR(50) NOT NULL,
  access_level VARCHAR(50) NOT NULL,

  tech_stack TEXT[] NOT NULL,
  primary_language VARCHAR(50),
  frameworks TEXT[],

  github_url VARCHAR(500),
  github_repo_name VARCHAR(255),
  demo_url VARCHAR(500),
  documentation_url VARCHAR(500),

  thumbnail_image_url VARCHAR(500),
  screenshot_urls TEXT[],
  demo_video_url VARCHAR(500),

  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  is_featured BOOLEAN DEFAULT false,
  featured_until TIMESTAMP,

  view_count INT DEFAULT 0,
  favorite_count INT DEFAULT 0,
  message_count INT DEFAULT 0,

  is_approved BOOLEAN DEFAULT true,
  rejection_reason TEXT,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_completion CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  CONSTRAINT valid_price CHECK (price_cents > 0)
);

CREATE INDEX idx_projects_seller_id ON projects(seller_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_category ON projects(category);
CREATE INDEX idx_projects_completion ON projects(completion_percentage);
CREATE INDEX idx_projects_primary_language ON projects(primary_language);
CREATE INDEX idx_projects_tech_stack ON projects USING GIN(tech_stack);

-- TRANSACTIONS TABLE
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  amount_cents INT NOT NULL CHECK (amount_cents > 0),
  commission_cents INT NOT NULL,
  seller_receives_cents INT NOT NULL,

  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  stripe_charge_id VARCHAR(255),
  payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',

  escrow_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  escrow_release_date TIMESTAMP,
  released_to_seller_at TIMESTAMP,

  code_delivery_status VARCHAR(50) DEFAULT 'pending',
  code_zip_url VARCHAR(500),
  code_accessed_at TIMESTAMP,
  github_access_granted_at TIMESTAMP,

  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,

  CONSTRAINT valid_amount CHECK (amount_cents > 0),
  CONSTRAINT valid_commission CHECK (commission_cents >= 0),
  CONSTRAINT seller_not_buyer CHECK (seller_id != buyer_id)
);

CREATE INDEX idx_transactions_project_id ON transactions(project_id);
CREATE INDEX idx_transactions_seller_id ON transactions(seller_id);
CREATE INDEX idx_transactions_buyer_id ON transactions(buyer_id);
CREATE INDEX idx_transactions_escrow_status ON transactions(escrow_status);

-- REVIEWS TABLE
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  transaction_id UUID UNIQUE NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id),
  buyer_id UUID NOT NULL REFERENCES users(id),

  overall_rating INT NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  comment TEXT,

  code_quality_rating INT CHECK (code_quality_rating IS NULL OR (code_quality_rating >= 1 AND code_quality_rating <= 5)),
  documentation_rating INT CHECK (documentation_rating IS NULL OR (documentation_rating >= 1 AND documentation_rating <= 5)),
  responsiveness_rating INT CHECK (responsiveness_rating IS NULL OR (responsiveness_rating >= 1 AND responsiveness_rating <= 5)),
  accuracy_rating INT CHECK (accuracy_rating IS NULL OR (accuracy_rating >= 1 AND accuracy_rating <= 5)),

  is_anonymous BOOLEAN DEFAULT false,
  helpful_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reviews_seller_id ON reviews(seller_id);
CREATE INDEX idx_reviews_buyer_id ON reviews(buyer_id);

-- MESSAGES TABLE
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,

  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT sender_not_recipient CHECK (sender_id != recipient_id)
);

CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX idx_messages_is_read ON messages(is_read);

-- FAVORITES TABLE
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT unique_favorite UNIQUE(user_id, project_id)
);

CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_project_id ON favorites(project_id);

-- SELLER ANALYTICS TABLE
CREATE TABLE seller_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  total_projects_listed INT DEFAULT 0,
  total_projects_sold INT DEFAULT 0,
  total_revenue_cents INT DEFAULT 0,

  average_rating NUMERIC(3,2),
  total_reviews INT DEFAULT 0,

  total_favorites INT DEFAULT 0,
  total_views INT DEFAULT 0,

  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_seller_analytics_seller_id ON seller_analytics(seller_id);
```

## 3. API ENDPOINTS (REST)

### Authentication

```
POST   /api/auth/github
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/refresh-token
```

### Projects (CRUD)

```
GET    /api/projects
GET    /api/projects/:id
POST   /api/projects
PATCH  /api/projects/:id
DELETE /api/projects/:id
GET    /api/projects/:id/github-preview
```

### Search & Discovery

```
GET    /api/search
GET    /api/projects/trending
GET    /api/projects/featured
GET    /api/projects/by-completion
GET    /api/projects/by-tech-stack/:tag
```

### Transactions & Payments

```
POST   /api/transactions/create-intent
POST   /api/transactions/:id/confirm
GET    /api/transactions/:id
GET    /api/transactions/history
POST   /api/transactions/:id/download
```

### Messaging

```
GET    /api/messages
GET    /api/messages/:id
POST   /api/messages
PATCH  /api/messages/:id/read
```

### Reviews

```
POST   /api/reviews
GET    /api/reviews/seller/:id
PATCH  /api/reviews/:id
```

### User Profiles

```
GET    /api/users/:username
GET    /api/users/me
PATCH  /api/users/me
GET    /api/users/:id/projects
GET    /api/users/:id/reviews
```

### Seller Dashboard

```
GET    /api/seller/dashboard
GET    /api/seller/analytics
GET    /api/seller/payouts
POST   /api/seller/featured-placement
```

### Webhooks

```
POST   /api/webhooks/stripe
POST   /api/webhooks/github
```

## 4. FRONTEND COMPONENTS (Key Screens)

**Homepage:**

- Hero section (CTA buttons)
- Featured projects carousel
- Search bar + quick filters
- How it works section
- Testimonials

**Project Search:**

- Search bar (full-text)
- Sidebar filters (completion %, tech, price, category, language)
- Sort options
- Project grid/cards

**Project Detail:**

- Project header (title, completion %, price, seller)
- Media carousel (screenshots, video)
- Full description
- Tech stack badges
- GitHub preview embed
- Seller card
- Reviews section
- Related projects
- Buy button

**Checkout:**

- Order summary
- Stripe card form
- Place order button

**Seller Dashboard:**

- Overview stats
- Projects list (with edit/publish options)
- Analytics charts
- Transaction history
- Payout settings

**Buyer Dashboard:**

- Purchase history
- Download links
- Favorites/watchlist
- Saved searches

**Project Form:**

- Title, description
- Completion slider
- Estimated hours
- Known issues textarea
- Price input
- Category, tech stack, language selects
- License type, access level
- GitHub URL
- Image upload
- Video URL

**Messaging:**

- Conversation list
- Chat thread with messages
- Message input

**Profile:**

- Profile header (avatar, bio)
- Seller stats (projects, sales, rating)
- Reviews list
- Projects list

## 5. CRITICAL WORKFLOWS

### Project Creation Flow

Seller clicks "New Project" → Form with all fields → Preview → Publish → Live listing

### Purchase Flow

Buyer searches → Filters projects → Clicks project → Details page → (Optional) Message seller → Buy Now → Stripe checkout → Order confirmation → Code download

### Escrow Flow

Payment received → 7-day hold → Buyer downloads code → Escrow releases → Seller gets paid → Review requests sent

### Dispute Flow

Buyer reports issue → Support email to seller → Seller responds/fixes → Resolved or refund authorized

## 6. INFRASTRUCTURE & DEPLOYMENT

**Frontend:** Vercel
**Backend:** AWS EC2 or Railway or Fly.io
**Database:** AWS RDS PostgreSQL
**Cache:** Redis
**File Storage:** AWS S3
**CDN:** CloudFront
**Monitoring:** Sentry, DataDog
**CI/CD:** GitHub Actions

## 7. SECURITY & COMPLIANCE

- GitHub OAuth (no password storage)
- JWT tokens (15 min access, 7 day refresh)
- HTTPS only
- CSRF protection
- PII encrypted at rest
- Payment info via Stripe (PCI compliant)
- Signed URLs for code downloads (1-hour expiry)
- GDPR & CCPA compliance
- Terms of Service & Privacy Policy

## 8. PERFORMANCE TARGETS

- Page load: < 3 seconds
- API response: < 200ms (p95)
- Search response: < 500ms
- Support 100K concurrent users

## 9. TESTING STRATEGY

- Unit tests (70%+ coverage)
- Integration tests (auth, listings, transactions)
- E2E tests (user journeys)
- Load testing (concurrent users)
- Security testing (OWASP Top 10)
