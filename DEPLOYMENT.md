# dtcapture26 Deployment Workflow

This document outlines the deployment workflow for the dtcapture26 application, including development and production environments.

## Environment Setup

The project is configured with two environments:

1. **Development Environment**
   - GitHub Branch: `develop`
   - Firebase Hosting: `dtcapture26-dev.web.app`
   - Purpose: Testing new features before production release
   - Database: FootieTeamz26 realtime database

2. **Production Environment**
   - GitHub Branch: `main`
   - Firebase Hosting: `dtcapture26.web.app`
   - Purpose: Live application for end users
   - Database: FootieTeamz26 realtime database

## Initial Repository Setup

Before using the deployment workflow, ensure your GitHub repository is correctly configured:

1. Run the update-remote script to set the correct GitHub repository:
   ```bash
   npm run update-remote
   ```
   This will set the remote origin to `https://github.com/cjcloud/dtcapture26.git`

2. The deployment scripts will automatically create the `develop` and `main` branches if they don't exist.

## Initial Setup Requirements

Before using this workflow, ensure you have:

1. Created a Firebase project with two hosting targets:
   - `dtcapture26` (production)
   - `dtcapture26-dev` (development)

2. Configured Firebase locally:
   ```bash
   # Login to Firebase
   firebase login

   # Set targets for hosting
   firebase target:apply hosting production dtcapture26
   firebase target:apply hosting development dtcapture26-dev
   ```

## Workflow Overview

### Development Workflow

1. Create feature branches from the `develop` branch
2. Implement and test new features locally
3. Merge changes into the `develop` branch
4. Deploy to development using the npm script:
   ```bash
   npm run deploy:dev
   ```
   This script will:
   - Add all changes to git
   - Commit the changes with a "Deploy to development" message
   - Push to the `develop` branch on GitHub
   - Clean the project directories
   - Build the application
   - Deploy to the development Firebase hosting environment

### Production Workflow

1. Merge changes from `develop` to `main` when features are ready for production
2. Deploy to production using the npm script:
   ```bash
   npm run deploy:prod
   ```
   This script will:
   - Add all changes to git
   - Commit the changes with a "Deploy to production" message
   - Push to the `main` branch on GitHub
   - Clean the project directories
   - Build the application
   - Deploy to the production Firebase hosting environment

## Available NPM Scripts

- `npm run deploy:dev`: Deploy to development environment
- `npm run deploy:prod`: Deploy to production environment
- `npm run clean`: Clean build directories
- `npm run build`: Build the Next.js application
- `npm run dev`: Run the application locally in development mode
- `npm run start`: Start the application locally from a production build
- `npm run update-remote`: Update the GitHub repository remote origin

## Troubleshooting

If deployments fail, check:

1. Git credentials and permissions
2. Firebase CLI authentication
3. Firebase project configuration in `.firebaserc`
4. Build errors in the Next.js application
