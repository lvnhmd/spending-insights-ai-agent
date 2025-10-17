# Spending Insights AI Agent - Web Application

This is the Next.js App Router web application for the Spending Insights AI Agent.

## Features

- **CSV Upload**: Upload transaction data for analysis
- **Insights Dashboard**: View personalized spending insights and recommendations
- **Autonomous Run Badge**: Shows the status of the latest autonomous AI analysis
- **Recommendation Cards**: Interactive cards with "Why this recommendation?" explanations
- **Progress Tracking**: Simple table showing savings progress and implemented actions

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.local.example .env.local
# Edit .env.local with your API Gateway URL
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
app/
├── app/                    # Next.js App Router
│   ├── (routes)/          # Route groups
│   │   ├── upload/        # CSV upload page
│   │   └── insights/      # Insights dashboard
│   ├── components/        # Reusable components
│   │   ├── AutonomousRunBadge.tsx
│   │   ├── RecommendationCard.tsx
│   │   └── ProgressTracker.tsx
│   ├── globals.css        # Global styles with Tailwind
│   ├── layout.tsx         # Root layout
│   └── page.tsx          # Home page
├── public/               # Static assets
└── package.json         # Dependencies and scripts
```

## Key Components

### AutonomousRunBadge
Displays the status of the latest autonomous AI run:
- "Last autonomous run: • 3 recs • 7.2s • 2h ago"
- Updates every 30 seconds
- Shows different colors based on run status (success/failed/running)

### RecommendationCard
Interactive cards for each AI recommendation:
- Shows potential savings, difficulty, and impact
- Expandable action steps
- "Why this recommendation?" explanation section
- Investment disclaimers for educational content

### ProgressTracker
Simple table showing user progress:
- Total savings achieved
- Monthly progress breakdown
- Recent money wins
- Success rate tracking

## API Integration

The app connects to the Lambda API handler with these endpoints:

- `POST /transactions/upload` - Upload CSV data
- `GET /users/{userId}/insights` - Get user insights
- `GET /autonomous-runs/latest` - Get latest autonomous run status
- `POST /users/{userId}/insights/generate` - Trigger new insights

## Environment Variables

- `NEXT_PUBLIC_API_BASE_URL` - API Gateway base URL

## Styling

Uses Tailwind CSS with custom component classes:
- `.btn`, `.btn-primary`, `.btn-secondary` - Button styles
- `.card` - Card container style
- `.badge` - Small status badges
- Custom color palette for success, warning, danger states

## Requirements Fulfilled

- ✅ Next.js App Router with /upload and /insights routes
- ✅ "Why this recommendation?" explanation cards
- ✅ "Last autonomous run" badge with DynamoDB data
- ✅ Basic progress tracking display (simple table format)
- ✅ Requirements 2.4, 5.3, 8.4, 8.5 addressed

## Development Notes

- Uses TypeScript for type safety
- Responsive design with mobile-first approach
- Error handling for API failures
- Loading states for better UX
- Educational disclaimers for investment content