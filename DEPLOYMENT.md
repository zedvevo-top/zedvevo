# Deployment Guide

This guide covers deploying ZedVevo to production using GitHub and Vercel.

## Prerequisites

- GitHub account with the repository pushed
- Vercel account (free tier available)
- Supabase project configured
- Lipila API credentials

## Git Deployment

The project is already configured with Git. To push changes:

```bash
# Stage changes
git add .

# Commit with a descriptive message
git commit -m "feat: add your feature description"

# Push to main branch
git push origin main
```

## Vercel Deployment

### Step 1: Connect GitHub to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Select "Import Git Repository"
4. Authorize GitHub and select the `zedvevo` repository
5. Click "Import"

### Step 2: Configure Environment Variables

In Vercel, set the following environment variables in Project Settings → Environment Variables:

```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

These should match your `.env` file values.

### Step 3: Configure Build Settings

Vercel should automatically detect the settings from `vercel.json`:

- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`
- **Framework:** Vite

### Step 4: Deploy

1. Click "Deploy"
2. Vercel will build and deploy your project
3. Your site will be available at `<project-name>.vercel.app`

### Step 5: Custom Domain (Optional)

1. In Vercel Project Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions

## Supabase Edge Functions Deployment

Edge functions are deployed separately:

```bash
# Login to Supabase
supabase login

# Deploy functions
supabase functions deploy
```

Or deploy specific functions:

```bash
supabase functions deploy lipila-payment
supabase functions deploy lipila-webhook
```

## Environment Variables Configuration

### Local Development (.env)

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Vercel Production

Set these in Vercel Project Settings:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase Function Secrets

Set in Supabase Dashboard:

```
LIPILA_API_KEY=your_lipila_api_key
LIPILA_WEBHOOK_URL=https://your-project.vercel.app/api/webhooks/lipila
LIPILA_API_URL=https://blz.lipila.io (production) or https://api.lipila.dev (sandbox)
```

## Database Migrations

### Apply Schema

```bash
# Connect to Supabase
supabase db pull  # Get latest schema

# Or push your local schema
supabase db push
```

### Verify Tables

The following tables should be created:
- `awards` - Award information
- `award_categories` - Categories within awards
- `nominees` - Nominee registrations
- `votes` - Vote records with payment tracking

## Verification Checklist

- [ ] GitHub repository is up to date
- [ ] Vercel project is connected to GitHub
- [ ] Environment variables are set in Vercel
- [ ] Build completes successfully
- [ ] Deployed site loads without errors
- [ ] Supabase tables are created
- [ ] Lipila API is configured
- [ ] Payment webhook URL is set correctly

## Troubleshooting

### Build Errors

```bash
# Clear cache and rebuild
npm run build

# Check for TypeScript errors
npm run lint
```

### Supabase Connection Issues

1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
2. Check Supabase project is active
3. Verify RLS policies allow public access

### Lipila Payment Issues

1. Verify `LIPILA_API_KEY` is set correctly
2. Check webhook URL is accessible from Lipila
3. Verify payment status in Supabase `payments` table

## Rollback

To rollback to a previous deployment:

1. Go to Vercel Dashboard → Deployments
2. Find the previous successful deployment
3. Click "Promote to Production"

## Monitoring

### Vercel Analytics

- Monitor build performance
- Track deployment history
- View real-time logs

### Supabase Monitoring

- Check Edge Function logs
- Monitor database performance
- View authentication events

## CI/CD Pipeline

Every push to `main` branch automatically:

1. Runs tests (if configured)
2. Builds the project
3. Deploys to Vercel
4. Updates the live site

## Support

For deployment issues:

1. Check Vercel logs: Project Settings → Function Logs
2. Check Supabase logs: Edge Functions → Logs
3. Review error messages in browser console
4. Check network requests in DevTools

## Production Checklist

Before going live:

- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Set up custom domain
- [ ] Configure analytics
- [ ] Enable error tracking
- [ ] Set up monitoring alerts
- [ ] Test all payment flows
- [ ] Verify email notifications
- [ ] Test user registration and voting
