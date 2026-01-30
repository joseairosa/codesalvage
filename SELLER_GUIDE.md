# Seller User Guide - CodeSalvage

**Welcome to CodeSalvage!** This guide will help you successfully list, manage, and sell your unfinished code projects.

---

## Table of Contents

1. [Getting Started as a Seller](#getting-started-as-a-seller)
2. [Listing Your First Project](#listing-your-first-project)
3. [Managing Your Listings](#managing-your-listings)
4. [Understanding Analytics](#understanding-analytics)
5. [Featured Listings](#featured-listings)
6. [Pro Subscription Benefits](#pro-subscription-benefits)
7. [Payments & Escrow](#payments--escrow)
8. [Reviews & Reputation](#reviews--reputation)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started as a Seller

### Creating Your Account

1. **Sign in with GitHub**
   - Click "Sign In" in the top navigation
   - Authorize CodeSalvage to access your GitHub profile
   - Your username and avatar will be imported automatically

2. **Complete Your Profile**
   - Navigate to your profile settings
   - Add a bio describing your expertise
   - Add links to your portfolio or personal website
   - Upload a professional avatar if you prefer not to use your GitHub avatar

3. **Become a Seller**
   - Your account is automatically enabled for both buying and selling
   - No additional verification required to list your first projects
   - Optional: Upgrade to Pro for verification badge and unlimited listings

### Understanding the Seller Dashboard

Access your dashboard at `/seller/dashboard`:

- **Overview**: Quick stats on your projects, revenue, and engagement
- **Analytics**: Detailed charts and metrics (see [Understanding Analytics](#understanding-analytics))
- **Projects**: Manage all your active, draft, and sold listings
- **Messages**: Communicate with potential buyers and customers
- **Settings**: Manage your profile, payment settings, and preferences

---

## Listing Your First Project

### Step 1: Navigate to Create Project

Click "New Project" button in your seller dashboard or navigation menu.

**Note**: Free tier allows **3 active projects**. Upgrade to Pro for unlimited listings.

### Step 2: Fill in Project Details

#### Basic Information

**Title** (required)

- Clear, descriptive name for your project
- Example: "E-commerce Dashboard with Analytics"
- Avoid generic titles like "My Project" or "Code for Sale"

**Description** (required)

- Explain what the project does
- Highlight key features and functionality
- Mention what's completed vs. what's remaining
- Include technical highlights (architecture, patterns used)
- Recommended length: 200-500 words

**Category** (required)

- Choose the most relevant category:
  - Web Application
  - Mobile App
  - Backend/API
  - Dashboard/Admin Panel
  - Tool/Utility
  - Chrome Extension
  - Desktop Application
  - Other

#### Completion Status

**Completion Percentage** (required)

- Honest assessment: 0% to 100%
- Use the slider to set your project's completion level
- Example values:
  - 30%: Basic structure and core features
  - 60%: Most features working, needs polish
  - 80%: Feature-complete, needs testing/refinement
  - 95%: Nearly complete, minor bugs or finishing touches

**Estimated Completion Hours** (optional)

- How many hours would it take to finish the remaining work?
- Helps buyers understand the effort required
- Be realistic - buyers appreciate transparency

**Known Issues** (optional but recommended)

- List any bugs, missing features, or technical debt
- Example: "Authentication works but needs password reset flow"
- Transparency builds trust and reduces disputes

#### Technical Details

**Tech Stack** (required)

- Select all technologies used in your project
- Predefined options include: React, Vue, Node.js, Python, PostgreSQL, etc.
- Add custom tags if your stack isn't listed
- Minimum 1 tag, no maximum

**Primary Language** (required)

- The main programming language
- Used for search filtering

**Frameworks** (optional)

- Key frameworks used (Next.js, Express, Django, etc.)

#### Pricing

**Price** (required)

- Set price in USD (minimum $10)
- Consider these factors:
  - Completion percentage
  - Code quality and documentation
  - Market demand for the tech stack
  - Time saved for the buyer
- Typical ranges:
  - 30-50% complete: $50-$200
  - 50-70% complete: $200-$500
  - 70-90% complete: $500-$1,500+
  - 90%+ complete: $1,000-$5,000+

**Licensing & Access** (required)

- **License Type**:
  - Full Code Transfer: Buyer owns all rights
  - Limited License: Buyer can use but not resell
  - Custom: Define your own terms

- **Access Level**:
  - Full Access: Complete repository access
  - Read-Only: Buyer can view but not modify on platform
  - ZIP Download: Buyer receives code archive

#### Media Assets

**Thumbnail Image** (required)

- Main image shown in search results and project cards
- Recommended size: 1200x630px
- Should showcase your project's UI or architecture
- Formats: JPG, PNG, WebP

**Screenshots** (recommended)

- Upload 3-8 screenshots showing key features
- Max 10MB per image
- Show actual UI, not placeholder screens

**Demo Video** (optional but highly recommended)

- YouTube or Vimeo embed URL
- 2-5 minute walkthrough of features
- Shows project in action better than screenshots
- Significantly increases conversion rates

#### Code & Demo Links

**GitHub Repository** (optional but recommended)

- Link to a public repo (or make repo public temporarily)
- Buyers can preview code quality before purchase
- Increases trust and reduces questions
- You can make private after sale

**Live Demo URL** (optional)

- Link to a deployed demo of the project
- Use free hosting: Vercel, Netlify, Railway
- Significantly increases buyer confidence

**Documentation URL** (optional)

- Link to README, wiki, or docs site
- Helps buyers understand setup and architecture

### Step 3: Save as Draft or Publish

**Save as Draft**

- Saves your progress without publishing
- Not visible to buyers
- You can edit and publish later
- Drafts don't count toward your 3-project limit (free tier)

**Publish**

- Makes your project visible in search
- Buyers can view, favorite, and purchase immediately
- Counts toward your active project limit
- You can edit or delist anytime

---

## Managing Your Listings

### Viewing Your Projects

Navigate to `/seller/dashboard` to see all your projects in a table:

- **Draft**: Not yet published
- **Active**: Live and visible to buyers
- **Sold**: Successfully sold (archived automatically)
- **Delisted**: Removed from public view

### Editing a Project

1. Click "Edit" button next to the project
2. Update any field (title, description, price, images, etc.)
3. Click "Save Changes"
4. Changes are live immediately

**Note**: If a project is sold, you cannot edit it (only view).

### Delisting a Project

If you want to remove a project from public view:

1. Click "Delist" button
2. Confirm action
3. Project is hidden from search but not deleted
4. You can re-publish later if desired

### Deleting a Project

**Warning**: This action is permanent and cannot be undone.

1. Click "Delete" button
2. Confirm deletion
3. Project and all associated data (views, favorites) are removed
4. If project was sold, deletion is prevented (data retention for support)

### Understanding Project Limits

**Free Tier**

- Maximum **3 active projects** at a time
- Unlimited drafts (not published)
- When you reach 3 active projects, you must:
  - Delist or delete an existing project before publishing a new one
  - OR upgrade to Pro for unlimited listings

**Pro Tier** ($9.99/month)

- **Unlimited active projects**
- No restrictions on drafts or published listings
- See [Pro Subscription Benefits](#pro-subscription-benefits)

---

## Understanding Analytics

Access analytics at `/seller/dashboard` (Analytics Dashboard section).

### Overview Metrics (Summary Cards)

**Total Revenue**

- Lifetime earnings from all sold projects
- Displayed in USD
- Shows total sales count

**Projects Listed**

- Number of active listings
- Includes both published and draft projects

**Total Views**

- Aggregate views across all your projects
- Buyers viewing your project detail pages

**Conversion Rate**

- (Total Sales / Total Views) × 100
- Indicates how well your listings convert browsers to buyers
- Industry average: 2-5%

### Date Range Selector

Select time period for detailed analytics:

- Last 7 days
- Last 30 days (default)
- Last 90 days
- Last year

### Revenue Over Time Chart

**Line Chart**: Shows revenue trends over selected period

- X-axis: Date
- Y-axis: Revenue in USD
- Hover over data points for exact values
- Granularity adjusts based on date range:
  - 7 days: Daily data points
  - 30 days: Daily data points
  - 90+ days: Weekly data points

**Use Cases**:

- Identify sales spikes (correlate with featured listings or marketing)
- Understand seasonal trends
- Plan when to list new projects

### Top Performing Projects

**Table View**: Your best projects ranked by revenue

- Shows top 5 projects by default
- Metrics per project:
  - **Views**: Total project detail page views
  - **Favorites**: Users who saved to favorites
  - **Sales**: Number of completed transactions
  - **Revenue**: Total earnings from this project

**Use Cases**:

- Identify what types of projects sell best
- Understand which tech stacks are in demand
- Guide future project selection

### Engagement Overview Chart

**Bar Chart**: Compare views, favorites, and sales across top 5 projects

- Blue bars: Views
- Pink bars: Favorites
- Green bars: Sales
- Side-by-side comparison for each project

**Use Cases**:

- Identify projects with high views but low sales (pricing issue?)
- See which projects generate interest (favorites) but don't convert
- Optimize pricing and descriptions based on engagement patterns

### Exporting Analytics

**CSV Export**:

1. Click "Export CSV" button
2. Downloads a spreadsheet with:
   - Project titles
   - Views, favorites, sales counts
   - Revenue per project
3. Filename: `analytics-YYYY-MM-DD.csv`
4. Open in Excel, Google Sheets, or Numbers for further analysis

---

## Featured Listings

### What Are Featured Listings?

Featured listings receive **premium placement** on CodeSalvage:

- ⭐ Featured badge on project card
- Priority placement in search results
- Increased visibility in category pages
- Highlighted in homepage carousel (if top-rated)

### Pricing & Duration

| Duration | Standard Price | Pro Discount (20% off) |
| -------- | -------------- | ---------------------- |
| 1 Week   | $49            | $39                    |
| 2 Weeks  | $79            | $63                    |
| 1 Month  | $129           | $103                   |

**Note**: Pro subscribers receive 20% discount on all featured listings.

### How to Purchase Featured Placement

1. Navigate to your project detail page
2. Click "Feature This Project" button (visible to project owner only)
3. Select duration (7, 14, or 30 days)
4. Review pricing (discount shown if you're Pro subscriber)
5. Click "Purchase"
6. Payment is processed immediately (deducted from your seller balance or charged separately)
7. Featured status activates within 5 minutes

### Featured Listing Benefits

**Increased Visibility**:

- 3-5x more views on average
- Higher click-through rate in search results
- Featured badge attracts attention

**Better Conversion**:

- Social proof (featured = quality)
- Buyers associate featured with top projects
- Typically 20-30% higher conversion rate

**When to Use Featured Listings**:

- ✅ Newly launched project (drive initial traffic)
- ✅ High-quality project that deserves more attention
- ✅ Before holidays or peak buying seasons
- ✅ When you've just improved a project (new features, better docs)
- ❌ Low-quality or incomplete projects (won't convert well)
- ❌ Projects with poor screenshots or descriptions

### Featured Listing Duration

- Duration starts immediately upon purchase
- Countdown visible in your seller dashboard
- Automatic expiration at end of period
- You'll receive an email notification 2 days before expiration
- Option to extend or purchase another featured period

---

## Pro Subscription Benefits

### Pro Seller Plan: $9.99/month

Upgrade to Pro for advanced seller features:

#### 1. **Unlimited Project Listings**

- Free tier: 3 active projects
- Pro tier: **No limit**
- List as many projects as you want simultaneously

#### 2. **Verified Pro Badge** ✅

- Shield badge displayed on your profile
- Shown next to your name on project listings
- Builds buyer trust
- Only available to active Pro subscribers

#### 3. **Featured Listing Discounts**

- 20% off all featured placements
- Example: 1-month featured for $103 instead of $129
- Significant savings if you use featured often

#### 4. **Advanced Analytics**

- All standard analytics PLUS:
  - Traffic sources (where buyers found you)
  - Conversion funnel breakdown
  - Revenue forecasting
  - Comparative benchmarks (how you rank vs. other sellers)

#### 5. **Priority Support**

- Faster response times for support tickets
- Dedicated seller success manager (coming soon)

### How to Subscribe

1. Navigate to `/pricing`
2. Click "Upgrade to Pro" under Pro Seller plan
3. Enter payment information (Stripe secure checkout)
4. Billing is monthly, cancel anytime
5. Pro benefits activate immediately

### Cancellation Policy

- Cancel anytime from your dashboard
- Pro benefits remain active until end of billing period
- No refunds for partial months
- Project limit reverts to 3 upon cancellation (existing projects remain visible until you delist)

---

## Payments & Escrow

### How Payment Works

1. **Buyer Purchases Project**
   - Buyer completes payment via Stripe
   - Funds are held in escrow (not immediately transferred to you)

2. **7-Day Escrow Period**
   - Buyer receives code immediately
   - Buyer has 7 days to review and raise disputes
   - Purpose: Ensures buyer received what was described

3. **Escrow Release**
   - After 7 days, if no dispute, funds are released to your account
   - You receive email notification
   - Funds transfer to your linked payout method

4. **Payout**
   - Automatic transfer to your connected Stripe account
   - Or manual payout request (minimum $50 balance)

### Fee Structure

**Platform Commission**: 18% of sale price

- Example: $500 project → You receive $410 (after $90 commission)
- Covers payment processing, hosting, support

**Stripe Fees**: 2.9% + $0.30 per transaction

- Deducted from gross sale price
- Standard for online payments

**Example Calculation**:

- Sale Price: $500
- Stripe Fee: $14.80 (2.9% + $0.30)
- Platform Commission: $90 (18%)
- **You Receive**: $395.20

### Setting Up Payouts

**Required**: Connect your Stripe account

1. Navigate to `/seller/settings/payouts`
2. Click "Connect Stripe Account"
3. Complete Stripe onboarding (5 minutes):
   - Business or individual account
   - Tax information (W-9 for US, W-8BEN for international)
   - Bank account details
4. Verification usually takes 1-2 business days
5. Once verified, you can receive payouts

**Payout Schedule**:

- Automatic: Weekly (every Monday if balance > $50)
- Manual: Request payout anytime (minimum $50)
- First payout may take 7-10 days (Stripe verification)

---

## Reviews & Reputation

### How Reviews Work

**Buyers Can Review After Purchase**:

- Only verified buyers who completed a transaction can review
- Review window: 30 days after purchase
- One review per transaction

**Review Components**:

- Overall rating (1-5 stars, required)
- Written comment (optional)
- Detailed ratings (optional):
  - Code quality
  - Documentation quality
  - Seller responsiveness
  - Accuracy of description

### Your Seller Rating

**Displayed On**:

- Your seller profile page
- Next to your name on project listings (if 4+ stars)
- Search results (sort by seller rating)

**Calculation**:

- Average of all overall ratings
- Minimum 3 reviews before public display
- Recent reviews weighted slightly higher (last 6 months)

**Impact on Sales**:

- 4.5+ stars: Significantly increases conversion
- 3.5-4.4 stars: Average performance
- Below 3.5 stars: Major trust issues, consider improving

### Responding to Reviews

**You Can Respond** to any review:

1. Navigate to review on your profile
2. Click "Respond"
3. Write professional, helpful response
4. Published publicly below buyer's review

**Best Practices**:

- Thank buyers for positive reviews
- Address concerns in negative reviews professionally
- Offer to help resolve issues (shows future buyers you care)
- Never argue or be defensive

**Example Responses**:

**Positive Review**:

> "Thank you! I'm glad the project met your needs. Feel free to reach out if you have any questions as you continue development."

**Negative Review** (e.g., "Code was messy"):

> "I appreciate your feedback. I acknowledge the code could have been better organized. I've since improved my coding standards and future projects reflect this. I'm happy to answer any questions about the architecture if it helps."

---

## Best Practices

### 1. Write Detailed Descriptions

**Do**:

- Explain what the project does in plain English
- List all major features completed
- Specify what's remaining to be built
- Include setup instructions or complexity notes
- Mention any unique architecture or interesting implementations

**Don't**:

- Use vague descriptions like "Good project" or "Code for sale"
- Oversell or exaggerate completion status
- Leave out known issues
- Use excessive jargon without explanation

### 2. Use High-Quality Images

**Screenshots**:

- Capture actual UI, not placeholder screens
- Show different pages/features
- Use consistent lighting/theme
- Crop out sensitive data (API keys, personal info)

**Thumbnail**:

- Eye-catching but representative
- Include project name/logo if available
- Test how it looks at small sizes (search results)

### 3. Be Transparent About Completion

**Honesty Builds Trust**:

- Accurate completion % reduces disputes
- List known issues upfront
- Buyers appreciate transparency
- Better to under-promise and over-deliver

**Example**:

> "Project is 70% complete. Authentication, dashboard, and user management are fully functional. Payment integration is started but not complete (estimated 15-20 hours). Needs testing and deployment setup."

### 4. Provide a Demo

**Live Demo > Video > Screenshots**:

- Deploy to free hosting (Vercel, Netlify, Railway)
- Or record a 3-5 minute demo video
- Show actual functionality, not just static screens
- Buyers are 3x more likely to purchase with a demo

### 5. Price Competitively

**Research Similar Projects**:

- Search for projects with similar tech stack
- Compare completion percentages
- Adjust pricing based on quality and features

**Pricing Strategy**:

- Start slightly lower to build reviews
- Increase price as you gain reputation
- Offer "first buyer discount" in description
- Consider bundling related projects

### 6. Respond to Messages Quickly

**Buyer Questions**:

- Respond within 24 hours (faster is better)
- Be helpful and professional
- Answer technical questions honestly
- If you don't know, say so

**Impact on Sales**:

- Fast responses build trust
- Buyers often message multiple sellers; first to respond often wins
- Responsiveness affects your rating

### 7. Keep Projects Updated

**Update When**:

- You make improvements (bug fixes, new features)
- You update screenshots or demo
- You adjust pricing based on completion
- Technology versions change (update tech stack tags)

### 8. Leverage Featured Listings Strategically

**When to Feature**:

- Launch week (drive initial traffic)
- After major updates (let buyers know)
- Before holidays (increased buyer activity)
- When conversion rate is high (maximize ROI)

**Don't Feature**:

- Immediately without testing regular listing first
- Projects with poor descriptions or images
- Projects with low completion or quality

---

## Troubleshooting

### Issue: "Project limit reached" error

**Cause**: Free tier is limited to 3 active projects.

**Solutions**:

1. Delist or delete an existing project
2. Upgrade to Pro for unlimited listings

**Note**: Drafts don't count toward limit.

---

### Issue: Can't edit published project

**Check**:

- Is the project sold? Sold projects are read-only.
- Are you logged in as the project owner?

**Solution**:

- If sold, you cannot edit (contact support if critical fix needed)
- Ensure you're logged in with the correct account

---

### Issue: Images not uploading

**Common Causes**:

- File too large (max 10MB per image)
- Unsupported format (use JPG, PNG, or WebP)
- Network issue during upload

**Solutions**:

1. Compress images using TinyPNG or Squoosh
2. Convert to supported format
3. Check internet connection and retry
4. Try uploading one image at a time

---

### Issue: Low views on my project

**Possible Reasons**:

- New listing (needs time to gain traction)
- Poor SEO (vague title or missing tech stack tags)
- Competitive category
- Low completion percentage

**Solutions**:

- Use specific, searchable title (include main tech stack)
- Add all relevant tech stack tags
- Improve thumbnail and screenshots
- Consider featured listing to boost initial visibility
- Share on social media (Twitter, Reddit /r/SideProject)

---

### Issue: High views but no sales

**Possible Reasons**:

- Price too high for completion level
- Unclear description or missing details
- Poor code quality (visible in GitHub preview)
- Missing demo or screenshots

**Solutions**:

- Review pricing vs. similar projects
- Add more detail to description
- Add live demo or video walkthrough
- Improve screenshots to show value
- Add buyer testimonials if you have any

---

### Issue: Dispute from buyer

**Buyer Claims**:

- Project doesn't match description
- Code doesn't run
- Missing features

**How Disputes Work**:

1. Buyer opens dispute within 7-day escrow period
2. Platform reviews both sides (description, code, messages)
3. Decision made within 2-3 business days
4. Outcome: Full refund, partial refund, or no refund

**Protect Yourself**:

- Accurate descriptions and completion %
- List known issues upfront
- Respond to pre-sale questions thoroughly
- Include setup instructions with code delivery
- Offer to help with setup (builds goodwill)

**If Dispute Opened**:

- Respond professionally within 24 hours
- Provide evidence (screenshots, messages, code files)
- Offer reasonable solution (partial refund, extended support)
- Learn from feedback to improve future listings

---

### Issue: Payout not received

**Check**:

1. Has 7-day escrow period passed?
2. Is your Stripe account fully verified?
3. Do you have minimum $50 balance (for automatic payouts)?
4. Check email for Stripe notifications

**Solutions**:

- Wait for escrow release (automatic after 7 days)
- Complete Stripe verification if pending
- Request manual payout if below auto-threshold
- Contact support if overdue (support@codesalvage.com)

---

### Issue: Can't connect Stripe account

**Common Issues**:

- Already connected to another platform
- Verification documents needed
- Country not supported by Stripe Connect

**Solutions**:

- Use a different Stripe account
- Complete identity verification via Stripe
- Check Stripe's supported countries list
- Contact support for alternative payout methods

---

## Getting Help

### Support Channels

**Email Support**: support@codesalvage.com

- Response time: 24-48 hours (Pro: 12-24 hours)
- Include: Account email, project URL (if applicable), screenshots

**Documentation**:

- Seller Guide (this document)
- Buyer Guide: `/buyer-guide`
- FAQ: `/faq`

**Community** (coming soon):

- Discord server for sellers
- Share tips, ask questions, network

---

## Success Stories

> "Listed my half-finished SaaS dashboard for $800. Sold within a week! The buyer finished it and now has a successful product. Win-win."
> — **Alex M.**, React Developer

> "I had 5 abandoned projects collecting dust. Listed all 5, sold 3 in the first month. Made $2,400 from code I thought was worthless."
> — **Sarah K.**, Full-stack Developer

> "Featured listing was worth it. Got 10x more views and sold my project for $1,200 in 3 days. Would definitely use again."
> — **Jordan P.**, Pro Seller

---

## Conclusion

CodeSalvage helps you monetize unfinished projects and turn abandoned code into revenue. Follow this guide to maximize your success:

1. ✅ Write detailed, honest descriptions
2. ✅ Use high-quality screenshots and demos
3. ✅ Price competitively based on completion
4. ✅ Respond to buyer questions quickly
5. ✅ Build your reputation with great service
6. ✅ Consider Pro subscription for serious sellers
7. ✅ Use featured listings strategically

**Ready to list your first project?** Click "New Project" in your dashboard and start earning!

---

**Questions?** Email us at support@codesalvage.com or visit our FAQ at `/faq`.

**Last Updated**: January 28, 2026
