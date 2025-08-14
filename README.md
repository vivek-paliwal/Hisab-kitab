# Hisab-Kitab React App

A comprehensive financial management application built with React, Firebase, and Tailwind CSS.

## Features

- **User Authentication** - Secure registration and login with Firebase Auth
- **Onboarding Flow** - 7-step questionnaire to understand user's financial profile
- **Dashboard** - Real-time financial overview with charts and analytics
- **Transaction Management** - Add, edit, and delete income/expense transactions
- **AI Assistant** - AI-powered financial insights and recommendations
- **Budget Planning** - Create and manage monthly budgets
- **Saving Goals** - Set and track savings targets
- **Dark/Light Theme** - Toggle between themes with preference saving
- **Responsive Design** - Works seamlessly on desktop and mobile

## Tech Stack

- **Frontend**: React 18, React Router, Tailwind CSS
- **Backend**: Firebase (Auth, Firestore)
- **Charts**: Chart.js with React Chart.js 2
- **Icons**: Font Awesome
- **Styling**: Tailwind CSS via CDN

## Project Structure

```
src/
├── components/
│   ├── Layout/
│   │   ├── Header.js
│   │   └── Footer.js
│   └── Dashboard/
│       └── Charts.js
├── contexts/
│   ├── AuthContext.js
│   ├── ThemeContext.js
│   └── ToastContext.js
├── pages/
│   ├── HomePage.js
│   ├── LoginPage.js
│   ├── RegisterPage.js
│   ├── OnboardingPage.js
│   ├── WelcomePage.js
│   ├── PersonalizePage.js
│   ├── DashboardPage.js
│   ├── TransactionsPage.js
│   ├── SettingsPage.js
│   ├── AboutPage.js
│   ├── MyBudgetPage.js
│   └── SavingGoalsPage.js
├── utils/
│   └── firebase.js
├── App.js
└── index.js
```

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd hisab-kitab-react
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The app will open at `http://localhost:3000`

## Firebase Configuration

The app uses Firebase for authentication and database. The configuration is already set up in `src/utils/firebase.js`.

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm test` - Launches the test runner
- `npm run eject` - Ejects from Create React App (one-way operation)

## Key Features Explained

### 1. Authentication Flow
- Register with email, password, and API key
- Login with automatic redirect based on completion status
- Protected routes for authenticated users only

### 2. Onboarding Process
- 7 comprehensive questions about financial habits
- Progressive form with back/forward navigation
- Data stored in Firebase for personalization

### 3. Dashboard
- Real-time transaction updates
- Interactive charts (doughnut and bar charts)
- Financial summary cards
- AI assistant panel
- Recent transactions list

### 4. Transaction Management
- Add transactions with categories
- Edit existing transactions
- Delete transactions with confirmation
- Real-time filtering and search

### 5. AI Integration
- Requires API key for AI-powered insights
- Financial analysis and recommendations
- Budget and saving plan generation

## Deployment

Build the app for production:
```bash
npm run build
```

The `build` folder contains the production-ready files.

## Contributing

This is a college project demonstrating React concepts and Firebase integration. The code structure is kept simple for educational purposes.

## License

This project is for educational purposes only.