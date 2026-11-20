# MY AI - redesigned starter

Files:
- `index.html`: login/signup screen and chat layout
- `style.css`: monochrome blurred glassmorphism design
- `app.js`: Supabase email/password authentication and existing `/api/chat` connection

## Important setup
1. Create a Supabase project.
2. In Supabase, enable Email authentication.
3. Copy the Project URL and anon/public key from the project's API settings.
4. Paste them into `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `app.js`.
5. In Supabase Authentication URL settings, add your deployed Vercel website URL to the allowed redirect/site URLs.
6. Upload these three files to the root of your GitHub repository and commit.
7. Vercel will redeploy automatically.

Do NOT put a Supabase `service_role` key in `app.js`.
The chat form calls the existing `/api/chat` endpoint. The image-generation button is a placeholder until a supported image API is connected.
