# Singularity 🌌

Singularity is a high-performance, Superhuman-style email and calendar workflow hub. It integrates your Gmail inbox, sent threads, drafts, and Google Calendar schedule into a single, unified workspace powered by a local AI Co-Pilot.

---

## 🌟 Key Features

*   **Unified Inbox**: A minimalist, keyboard-shortcut-driven interface to read, compose, reply, and manage your emails. Includes full support for Inbox, Sent, and Drafts categories.
*   **Google Calendar Sync**: View your daily schedule and upcoming events side-by-side with your emails—no tab-switching required.
*   **Local Semantic Vector Search**: Lightning-fast (< 1s) natural language search across local cached email histories and calendar events. Uses PostgreSQL vector cosine similarity index (`hnsw`) and Gemini embeddings with a premium glassmorphic UI.
*   **Multi-Account OAuth Syncing**: Connect up to 3 separate Gmail or Calendar accounts (for premium users) without overwrites. System automatically groups matching pairs under unified tenant ID slots.
*   **AI Co-Pilot & Agent Behavior**: Summarize email threads, draft contextual replies, and configure behavior using **Careful Mode** (approves drafts) or **Autonomous Mode** (autopilot).
*   **DeepThink Reasoning Toggle**: Toggle between `deepseek-v4-pro` (rich reasoning/thinking output visible in chat) and `deepseek-v4-flash` (high-speed execution) modes in the agent workspace.
*   **Better Auth Integration**: Secure, session-based authentication with Google OAuth.
*   **Premium Theme System**: Beautifully responsive design supporting both light and dark modes with a persistent theme switcher.
*   **Production Ready**: Out-of-the-box support for serverless deployment on **Vercel** or containerized deployment on **Azure Container Apps** (Dockerized).

---

## 🛠️ Tech Stack

*   **Framework**: Next.js 15 (App Router, Server Actions, Standalone Output)
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS v4
*   **Database**: PostgreSQL with `pgvector` extension
*   **ORM**: Drizzle ORM
*   **Authentication**: Better Auth (Google Provider)
*   **API Layer**: tRPC (Client & Server)
*   **AI Integrations**: Vercel AI SDK (Gemini & DeepSeek support)

---

## 🚀 Local Setup Instructions

### Prerequisites
Make sure you have the following installed on your machine:
*   [Node.js (v20+)](https://nodejs.org)
*   [pnpm (v10+)](https://pnpm.io)
*   [PostgreSQL Database](https://www.postgresql.org/) (either local or a serverless database instance on Neon)

---

### Step 1: Clone the Repository
```bash
git clone <your-repo-url>
cd singularity
```

---

### Step 2: Install Dependencies
```bash
pnpm install
```

---

### Step 3: Configure Environment Variables
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in the required credentials:

```env
# Better Auth Secret (Generate a random 32-character string)
BETTER_AUTH_SECRET="your-better-auth-secret"

# Google OAuth Credentials (obtain from Google Cloud Console)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Database Connection (Neon or local PostgreSQL instance)
DATABASE_URL="postgresql://username:password@localhost:5432/singularity"

# Corsair Encryption Key (used for agent tools security)
CORSAIR_KEK="your-corsair-kek"

# Gemini API Key (for the AI Co-Pilot features)
GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-api-key"

# App URL (use http://localhost:3000 for local development)
APP_URL="http://localhost:3000"
```

---

### Step 4: Configure Google Cloud OAuth Console
To sign in with Google:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project and configure the **OAuth consent screen**.
3. Under **Credentials**, create an **OAuth 2.0 Client ID** (Web application).
4. Add the following **Authorized JavaScript origins**:
   * `http://localhost:3000` (for local development)
5. Add the following **Authorized redirect URIs**:
   * `http://localhost:3000/api/auth/callback/google` (standard Better Auth callback)
6. Copy the Client ID and Client Secret to your `.env` file.

---

### Step 5: Setup the Database
Push your database schema to your PostgreSQL database:
```bash
pnpm db:push
```
To inspect the database tables visually, you can start the Drizzle Studio interface:
```bash
pnpm db:studio
```

---

### Step 6: Start Local Development
Run the Next.js development server:
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) (or port `3001` if port 3000 is occupied) in your browser.

---

## 📦 Deployment Guides

### Option A: Vercel (Easiest)
1. Push your code to a GitHub repository.
2. Link your repository in [Vercel](https://vercel.com).
3. Paste all variables from your `.env` file into the Vercel project settings.
4. Click **Deploy**.
5. Once your Vercel URL is generated, go back to your Google Cloud Console and add your Vercel URL to the **Authorized JavaScript origins** and `https://<your-vercel-domain>/api/auth/callback/google` to the **Authorized redirect URIs**.

---

### Option B: Azure Container Apps
We have pre-configured a standalone Docker build setup.
1. Build the Docker container locally or in your CI/CD pipeline:
   ```bash
   docker build -t singularity-app:latest .
   ```
2. Push the built image to your **Azure Container Registry (ACR)**.
3. Deploy to **Azure Container Apps** pointing to target port `3000`.
4. Remember to update the `APP_URL` environment variable inside your Container App configuration to match your live Azure URL.

---

## 📖 Detailed System Documentation

For deep technical insights, architecture overviews, and implementation guides, refer to the following documentation in the `docs/` directory:

*   [Local Semantic Vector Search](file:///c:/Users/ASUS/Desktop/Axehuman/singularity/docs/semantic_search.md): Details the vector embedding pipeline, the PostgreSQL HNSW index, similarity ranking algorithms, and UI integration.
*   [Multi-Account Integrations & Tenant Slots](file:///c:/Users/ASUS/Desktop/Axehuman/singularity/docs/multi_account_integrations.md): Explains how Google OAuth connections are established, the unified pairing logic, and how we handle up to 3 separate connection slots for premium accounts without conflicts.
*   [AI Co-Pilot & Agent Modes](file:///c:/Users/ASUS/Desktop/Axehuman/singularity/docs/agent_routing.md): Outlines the Careful vs. Autonomous modes, the DeepThink reasoning toggle, and how the model-mode switching (careful, quick) is implemented behind the scenes.
