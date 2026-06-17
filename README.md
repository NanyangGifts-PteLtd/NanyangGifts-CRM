<h1 align="center">NanyangGifts CRM</h1>


<p align="center">
 Front-end: Next.js, Typescript, Tailwind CSS
 <br>
 Backend: Supabase, Vercel
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#clone-and-run-locally"><strong>Clone and run locally</strong></a> 
</p>
<br/>

## Features

  - to be updated 


## Clone and run locally

1. Clone this repo  
   ```
   gh repo clone Angeline-Leonardo/NanyangGifts-CRM
   ```

3. Use `cd` to change into the app's directory

   ```bash
   cd nanyanggifts-crm
   ```

4. Add `.env.local` and update the following:

  ```env
  NEXT_PUBLIC_SUPABASE_URL=[INSERT SUPABASE PROJECT URL]
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=[INSERT SUPABASE PROJECT API PUBLISHABLE OR ANON KEY]
  ```

  Both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` can be found in [your Supabase project's API settings](https://supabase.com/dashboard/project/_?showConnect=true)

5. You can now run the Next.js local development server:

   ```bash
   npm run dev
   ```

   The web app should now be running on [localhost:3000](http://localhost:3000/).

6. This template comes with the default shadcn/ui style initialized. If you instead want other ui.shadcn styles, delete `components.json` and [re-install shadcn/ui](https://ui.shadcn.com/docs/installation/next)
