# Turso Database Setup (2 minutes)

1. Go to https://turso.tech and sign up (free tier is plenty)
2. Install Turso CLI locally:
   ```bash
   # macOS/Linux
   curl -sSfL https://get.turso.tech/install.sh | bash
   # Windows
   winget install tursodatabase.turso
   ```
3. Login: `turso auth login`
4. Create database: `turso db create couples-choice`
5. Get the URL: `turso db show couples-choice --url`
6. Create an auth token: `turso db tokens create couples-choice`
7. Copy both values — you'll add them to Vercel

## Push migrations to Turso
```bash
DATABASE_URL="libsql://[your-url]" DATABASE_AUTH_TOKEN="[your-token]" npx drizzle-kit push
```

## Add to Vercel
Go to https://vercel.com → your project → Settings → Environment Variables
Add:
- `DATABASE_URL` = `libsql://[your-url]`
- `DATABASE_AUTH_TOKEN` = `[your-token]`
- `TMDB_API_KEY` = (from .env.local)
- `DEEPSEEK_API_KEY` = (from .env.local)
