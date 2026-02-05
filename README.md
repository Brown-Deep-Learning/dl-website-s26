# dl-website-s26

Hey team, this is just the general idea that we have for the website. This years theme is **DEEP EARTH**. The motivation behind it is as we get deeper in the course, we get deeper into the Earth. The website will parallel this by changing the background as you scroll deeper on the website. I don't know what the exact layers of the Earth we want are, but I do know Eric wants us to end on mole people 🐀. 

Now, obviously, we want to prioritize functionality over aesthetics, but the website should look good so it's fun for the students. The general functionality of the website is
- General Course Overview/Description
- Syllabus and General Information/Links
- Most Recent Assignment and Most Recent Lecture
- Lecture List (there should be an easy way to upload lecture files (either a `data.ts` like we did last year or just search the `slides` folder, but may be weird with ordering)
- Assignment List (easy way to upload and link to both programming and conceptual with proper rendering)
- Course Calendar (maybe also a progress bar to track how far we are in the course)
- Resources/General CS links we need to have
- Course Staff (Pictures and make it on theme 👼)
- Make sure the website is dyanmic for both big screen and mobile users :) 
- DO NOT WORRY ABOUT FINAL PROJECT SECTION

  Last year's website: [Website](https://deep-learning-s25.vercel.app/)
  
  Last year's Github: [Repo](https://github.com/Brown-Deep-Learning/dl-website-s25/tree/updated-s25-website) (make sure you are on the `updated-s25-website` branch)
  

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Automated Content Sync

The website features automated synchronization of lecture content from Google Drive:

### Slides Sync (10 AM EST, Mon/Wed/Fri)
- Automatically downloads lecture slide PDFs from Google Drive
- Updates `slidesLink` in lectureData.ts
- Workflow: `.github/workflows/sync-slides.yml`
- Script: `scripts/sync-course-content.ts`

### Recordings Sync (5 PM EST, Mon/Wed/Fri)
- Reads the "Lecture Recordings" Google Sheet from the same Drive folder
- Updates lecture names and recording links based on the sheet data
- Only updates empty fields (won't overwrite existing data)
- Workflow: `.github/workflows/sync-recordings.yml`
- Script: `scripts/sync-lecture-recordings.ts`

### Available Commands
```bash
# Sync slides only (no git push)
npm run sync:slides

# Sync slides and push to GitHub
npm run sync:slides:push

# Sync recordings from Google Sheet (no git push)
npm run sync:recordings

# Sync recordings and push to GitHub
npm run sync:recordings:push

# Test authentication
npm run debug-auth
```

For detailed setup instructions, see [docs/RECORDINGS_SYNC_SETUP.md](docs/RECORDINGS_SYNC_SETUP.md).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:8000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
