# TweakBot

An AI-powered coding assistant with a web UI, backed by Groq (Llama) and Anthropic (Claude), with conversation history stored in Supabase.

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A [Groq](https://console.groq.com) account and API key
- An [Anthropic](https://console.anthropic.com) account and API key
- A [Supabase](https://supabase.com) project with the tables described below

## Supabase setup

Run the following SQL in your Supabase project's SQL editor:

```sql
create table messages (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table summaries (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  content text not null,
  created_at timestamptz not null default now()
);
```

## Local setup

1. **Clone the repo and install dependencies**

   ```bash
   git clone <repo-url>
   cd <repo-directory>
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Open `.env` and fill in your API keys:

   | Variable           | Where to get it                          |
   |--------------------|------------------------------------------|
   | `GROQ_API_KEY`     | https://console.groq.com                |
   | `ANTHROPIC_API_KEY`| https://console.anthropic.com           |
   | `SUPABASE_URL`     | Supabase project → Settings → API       |
   | `SUPABASE_ANON_KEY`| Supabase project → Settings → API       |
   | `PORT`             | Optional — defaults to `3000`           |

3. **Start the server**

   ```bash
   npm start
   ```

4. **Open the UI**

   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Project structure

```
├── index.js          # Express server and API routes
├── systemprompt.js   # System prompt for TweakBot
├── public/
│   └── index.html    # Web UI
├── core/             # Self-modification utilities
├── package.json
├── .env.example      # Environment variable template
└── README.md
```
