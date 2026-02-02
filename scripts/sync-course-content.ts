#!/usr/bin/env ts-node

/**
 * Course Content Sync Script
 *
 * This script synchronizes course content from external sources:
 * - Downloads lecture slides from Google Drive
 * - Fetches all lecture recordings from Panopto folder
 * - Matches recordings to lectures by comparing dates from lectureData.ts
 * - Updates lectureData.ts with the latest information
 * - Optionally commits and pushes changes to GitHub
 *
 * Usage:
 *   npm run sync                        # Sync both slides and recordings
 *   npm run sync -- --slides-only       # Only sync slides
 *   npm run sync -- --recordings-only   # Only sync recordings
 *   npm run sync -- --slides-only --push # Sync slides and push to GitHub
 */

import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
const CONFIG = {
  PANOPTO_BASE_URL: 'https://brown.hosted.panopto.com/Panopto',
  PANOPTO_CLIENT_ID: process.env.PANOPTO_CLIENT_ID,
  PANOPTO_CLIENT_SECRET: process.env.PANOPTO_CLIENT_SECRET,
  PANOPTO_USERNAME: process.env.PANOPTO_USERNAME,
  PANOPTO_PASSWORD: process.env.PANOPTO_PASSWORD,
  PANOPTO_FOLDER_ID: process.env.PANOPTO_FOLDER_ID?.replace(/"/g, ''), // Remove quotes
  GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID,
  GOOGLE_SERVICE_ACCOUNT_PATH: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON, // Base64 encoded JSON for CI/CD
  SLIDES_DIR: path.join(process.cwd(), 'public', 'slides'),
  LECTURE_DATA_PATH: path.join(process.cwd(), 'src', 'app', 'data', 'lectureData.ts'),
  // Git configuration
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GIT_USER_NAME: process.env.GIT_USER_NAME || 'Course Automation',
  GIT_USER_EMAIL: process.env.GIT_USER_EMAIL || 'automation@cs1470.com',
};

// Parse command line arguments
const args = process.argv.slice(2);
const shouldSyncSlides = !args.includes('--recordings-only');
const shouldSyncRecordings = !args.includes('--slides-only');
const shouldPush = args.includes('--push');

interface Lecture {
  id: number;
  title: string;
  date?: string;
  slidesLink?: string;
  recordingLink?: string;
}

interface LectureGroup {
  title?: string;
  lectures: Lecture[];
}

interface PanoptoSession {
  Id: string;
  Name: string;
  StartTime: string;
  FolderName?: string;
}

interface PanoptoAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * Authenticate with Panopto using refresh token (preferred) or password grant (fallback)
 */
async function authenticatePanopto(): Promise<string> {
  console.log('🔐 Authenticating with Panopto...');

  if (!CONFIG.PANOPTO_CLIENT_ID || !CONFIG.PANOPTO_CLIENT_SECRET) {
    throw new Error('Missing PANOPTO_CLIENT_ID or PANOPTO_CLIENT_SECRET in .env.local');
  }

  // Try refresh token first if available
  const refreshToken = process.env.PANOPTO_REFRESH_TOKEN;

  if (refreshToken) {
    console.log('  🔄 Using refresh token...');
    try {
      const response = await axios.post<PanoptoAuthResponse>(
        `${CONFIG.PANOPTO_BASE_URL}/oauth2/connect/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
        {
          auth: {
            username: CONFIG.PANOPTO_CLIENT_ID,
            password: CONFIG.PANOPTO_CLIENT_SECRET,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      console.log('✅ Panopto authentication successful (via refresh token)');
      return response.data.access_token;
    } catch (error: any) {
      console.error('⚠️  Refresh token authentication failed:', error.response?.data?.error_description || error.message);
      console.log('  ⤷ Falling back to password grant...');
    }
  } else {
    console.log('  ℹ️  No refresh token found, using password grant');
    console.log('  💡 Tip: Run "npm run panopto-auth" to set up OAuth2 with refresh token');
  }

  // Fall back to password grant
  if (!CONFIG.PANOPTO_USERNAME || !CONFIG.PANOPTO_PASSWORD) {
    throw new Error('Missing PANOPTO_USERNAME or PANOPTO_PASSWORD in .env.local. Run "npm run panopto-auth" to set up OAuth2 instead.');
  }

  try {
    const response = await axios.post<PanoptoAuthResponse>(
      `${CONFIG.PANOPTO_BASE_URL}/oauth2/connect/token`,
      new URLSearchParams({
        grant_type: 'password',
        username: CONFIG.PANOPTO_USERNAME,
        password: CONFIG.PANOPTO_PASSWORD,
        scope: 'api',
      }),
      {
        auth: {
          username: CONFIG.PANOPTO_CLIENT_ID,
          password: CONFIG.PANOPTO_CLIENT_SECRET,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log('✅ Panopto authentication successful (via password grant)');
    return response.data.access_token;
  } catch (error: any) {
    console.error('❌ Panopto authentication failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Fetch all recordings from Panopto folder
 */
async function fetchPanoptoRecordings(accessToken: string): Promise<PanoptoSession[]> {
  console.log('📹 Fetching Panopto recordings from folder...');

  if (!CONFIG.PANOPTO_FOLDER_ID) {
    throw new Error('Missing PANOPTO_FOLDER_ID in .env.local');
  }

  try {
    const allSessions: PanoptoSession[] = [];
    let pageNumber = 0;
    const pageSize = 100;
    let hasMorePages = true;

    // Fetch all recordings with pagination
    while (hasMorePages) {
      const response = await axios.get(
        `${CONFIG.PANOPTO_BASE_URL}/api/v1/sessions`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          params: {
            folderId: CONFIG.PANOPTO_FOLDER_ID,
            sortField: 'Date',
            sortOrder: 'Desc',
            pageNumber,
            pageSize,
          },
        }
      );

      const sessions = response.data.Results || [];
      allSessions.push(...sessions);

      // Check if there are more pages
      const totalResults = response.data.TotalNumberOfResults || 0;
      hasMorePages = allSessions.length < totalResults;
      pageNumber++;

      console.log(`  📄 Fetched page ${pageNumber}, got ${sessions.length} recordings (total: ${allSessions.length}/${totalResults})`);
    }

    console.log(`✅ Found ${allSessions.length} total recordings in folder`);
    return allSessions;
  } catch (error: any) {
    console.error('❌ Failed to fetch Panopto recordings:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Match Panopto recordings to lectures by date
 * Compares the lecture date from lectureData.ts with the recording date from Panopto
 */
function matchRecordingsToLectures(
  lectures: Lecture[],
  recordings: PanoptoSession[]
): Map<number, string> {
  console.log('🔗 Matching recordings to lectures by date from lectureData.ts...');
  console.log(`  📊 ${lectures.filter(l => l.date).length} lectures with dates`);
  console.log(`  🎬 ${recordings.length} recordings to match against`);

  const recordingMap = new Map<number, string>();
  let skippedCount = 0;

  for (const lecture of lectures) {
    if (!lecture.date) {
      skippedCount++;
      continue;
    }

    const lectureDate = new Date(lecture.date);

    // Find recording that matches the lecture date (same day)
    const matchedRecording = recordings.find(recording => {
      const recordingDate = new Date(recording.StartTime);
      return (
        recordingDate.getFullYear() === lectureDate.getFullYear() &&
        recordingDate.getMonth() === lectureDate.getMonth() &&
        recordingDate.getDate() === lectureDate.getDate()
      );
    });

    if (matchedRecording) {
      const recordingUrl = `${CONFIG.PANOPTO_BASE_URL}/Pages/Viewer.aspx?id=${matchedRecording.Id}`;
      recordingMap.set(lecture.id, recordingUrl);
      console.log(`  ✓ Lecture ${lecture.id} "${lecture.title}" (${lecture.date})`);
      console.log(`    → Matched to: "${matchedRecording.Name}"`);
    } else {
      console.log(`  ⊘ Lecture ${lecture.id} "${lecture.title}" (${lecture.date}) - no matching recording found`);
    }
  }

  if (skippedCount > 0) {
    console.log(`  ℹ️  Skipped ${skippedCount} lectures without dates`);
  }

  console.log(`\n✅ Matched ${recordingMap.size} recordings to lectures`);
  return recordingMap;
}

/**
 * Initialize Google Drive client with service account
 * Supports both file path (local) and base64 encoded JSON (CI/CD)
 */
async function initGoogleDrive() {
  console.log('🔐 Initializing Google Drive client...');

  let auth;

  // Check if base64 encoded JSON is provided (for CI/CD)
  if (CONFIG.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.log('  Using base64 encoded service account credentials (CI/CD mode)');
    try {
      const decodedJson = Buffer.from(CONFIG.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf-8');
      const credentials = JSON.parse(decodedJson);

      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });
    } catch (error: any) {
      throw new Error(`Failed to parse base64 encoded service account JSON: ${error.message}`);
    }
  }
  // Otherwise use file path (for local development)
  else if (CONFIG.GOOGLE_SERVICE_ACCOUNT_PATH) {
    console.log('  Using service account file path (local mode)');

    if (!fs.existsSync(CONFIG.GOOGLE_SERVICE_ACCOUNT_PATH)) {
      throw new Error(`Service account file not found: ${CONFIG.GOOGLE_SERVICE_ACCOUNT_PATH}`);
    }

    auth = new google.auth.GoogleAuth({
      keyFile: CONFIG.GOOGLE_SERVICE_ACCOUNT_PATH,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
  }
  else {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_PATH or GOOGLE_SERVICE_ACCOUNT_JSON in environment');
  }

  const drive = google.drive({ version: 'v3', auth });
  console.log('✅ Google Drive client initialized');
  return drive;
}

/**
 * List PDF files in Google Drive folder
 */
async function listDrivePDFs(drive: any): Promise<any[]> {
  console.log('📄 Listing PDF files from Google Drive...');

  if (!CONFIG.GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error('Missing GOOGLE_DRIVE_FOLDER_ID in .env.local');
  }

  try {
    const response = await drive.files.list({
      q: `'${CONFIG.GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/pdf' and trashed=false`,
      fields: 'files(id, name, modifiedTime, size)',
      orderBy: 'name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = response.data.files || [];
    console.log(`✅ Found ${files.length} PDF files in Google Drive`);
    return files;
  } catch (error: any) {
    console.error('❌ Failed to list Google Drive files:', error.message);
    throw error;
  }
}

/**
 * Download a file from Google Drive
 */
async function downloadDriveFile(drive: any, fileId: string, destPath: string): Promise<void> {
  const dest = fs.createWriteStream(destPath);

  const response = await drive.files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'stream' }
  );

  return new Promise((resolve, reject) => {
    response.data
      .on('end', () => resolve())
      .on('error', (err: any) => reject(err))
      .pipe(dest);
  });
}

/**
 * Sync slides from Google Drive
 */
async function syncSlides(): Promise<Map<number, string>> {
  console.log('\n📚 Starting slides sync...\n');

  const slidesMap = new Map<number, string>();

  try {
    const drive = await initGoogleDrive();
    const files = await listDrivePDFs(drive);

    // Ensure slides directory exists
    if (!fs.existsSync(CONFIG.SLIDES_DIR)) {
      fs.mkdirSync(CONFIG.SLIDES_DIR, { recursive: true });
    }

    console.log('⬇️  Checking and downloading slides...');

    for (const file of files) {
      // Match filename pattern like "lecture_1.pdf", "lecture_2.pdf"
      const match = file.name.match(/lecture[_\s-](\d+)\.pdf/i);

      if (match) {
        const lectureId = parseInt(match[1], 10);
        const filename = `lecture_${lectureId}.pdf`;
        const destPath = path.join(CONFIG.SLIDES_DIR, filename);

        try {
          // Check if file already exists and matches size
          if (fs.existsSync(destPath)) {
            const localStats = fs.statSync(destPath);
            const remoteSize = parseInt(file.size || '0', 10);
            
            if (localStats.size === remoteSize && remoteSize > 0) {
              slidesMap.set(lectureId, `slides/${filename}`);
              console.log(`  ⊙ Skipped (already exists): ${filename}`);
              continue;
            }
          }

          await downloadDriveFile(drive, file.id, destPath);
          slidesMap.set(lectureId, `slides/${filename}`);
          console.log(`  ✓ Downloaded: ${filename}`);
        } catch (error: any) {
          console.error(`  ✗ Failed to download ${filename}:`, error.message);
        }
      } else {
        console.log(`  ⊘ Skipped: ${file.name} (doesn't match pattern)`);
      }
    }

    console.log(`\n✅ Processed ${slidesMap.size} slides`);
    return slidesMap;
  } catch (error: any) {
    console.error('❌ Slides sync failed:', error.message);
    throw error;
  }
}

/**
 * Sync recordings from Panopto
 */
async function syncRecordings(lectures: Lecture[]): Promise<Map<number, string>> {
  console.log('\n🎥 Starting recordings sync...\n');

  try {
    const accessToken = await authenticatePanopto();
    const recordings = await fetchPanoptoRecordings(accessToken);
    const recordingMap = matchRecordingsToLectures(lectures, recordings);

    console.log(`\n✅ Found ${recordingMap.size} new recordings`);
    return recordingMap;
  } catch (error: any) {
    console.error('❌ Recordings sync failed:', error.message);
    throw error;
  }
}

/**
 * Parse lectureData.ts file and extract lecture groups
 */
function parseLectureData(): LectureGroup[] {
  console.log('📖 Reading lectureData.ts...');

  const fileContent = fs.readFileSync(CONFIG.LECTURE_DATA_PATH, 'utf-8');

  // Extract the lectureGroups array using regex
  const match = fileContent.match(/export const lectureGroups: LectureGroup\[\] = (\[[\s\S]*?\]);/);

  if (!match) {
    throw new Error('Could not parse lectureGroups from lectureData.ts');
  }

  // Use eval to parse the array (safe since we control the file)
  // eslint-disable-next-line no-eval
  const lectureGroups = eval(match[1]);

  console.log(`✅ Parsed ${lectureGroups.length} lecture groups`);
  return lectureGroups;
}

/**
 * Update lectureData.ts with new slides and recordings
 */
function updateLectureData(
  slidesMap: Map<number, string> | null,
  recordingsMap: Map<number, string> | null
): void {
  console.log('\n💾 Updating lectureData.ts...\n');

  const lectureGroups = parseLectureData();
  let updatedCount = 0;

  // Update lectures with new slides and recordings
  for (const group of lectureGroups) {
    for (const lecture of group.lectures) {
      let updated = false;

      if (slidesMap && slidesMap.has(lecture.id)) {
        const newSlidesLink = slidesMap.get(lecture.id)!;
        if (lecture.slidesLink !== newSlidesLink) {
          lecture.slidesLink = newSlidesLink;
          console.log(`  ✓ Updated slides for Lecture ${lecture.id}: ${lecture.title}`);
          updated = true;
        }
      }

      if (recordingsMap && recordingsMap.has(lecture.id)) {
        const newRecordingLink = recordingsMap.get(lecture.id)!;
        if (lecture.recordingLink !== newRecordingLink) {
          lecture.recordingLink = newRecordingLink;
          console.log(`  ✓ Updated recording for Lecture ${lecture.id}: ${lecture.title}`);
          updated = true;
        }
      }

      if (updated) updatedCount++;
    }
  }

  if (updatedCount === 0) {
    console.log('  ℹ️  No updates needed - all data is already current');
    return;
  }

  // Write updated data back to file
  const output = `// lecturesData.ts
import { LectureGroup } from "../types";

export const lectureGroups: LectureGroup[] = ${JSON.stringify(lectureGroups, null, 2)};
`;

  fs.writeFileSync(CONFIG.LECTURE_DATA_PATH, output, 'utf-8');
  console.log(`\n✅ Updated ${updatedCount} lectures in lectureData.ts`);
}

/**
 * Execute git command safely
 */
function execGit(command: string, options?: { silent?: boolean }): string {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: options?.silent ? 'pipe' : 'inherit',
    });
    // When stdio is 'inherit', execSync returns null, so we return empty string
    return result ? result.trim() : '';
  } catch (error: any) {
    throw new Error(`Git command failed: ${command}\n${error.message}`);
  }
}

/**
 * Check if there are changes to commit
 */
function hasChangesToCommit(): boolean {
  try {
    const status = execGit('git status --porcelain', { silent: true });
    return status.length > 0;
  } catch (error) {
    console.error('⚠️  Could not check git status');
    return false;
  }
}

/**
 * Get list of changed files for commit message
 */
function getChangedLectures(): string[] {
  try {
    const status = execGit('git status --porcelain public/slides/', { silent: true });
    const lectures: string[] = [];

    // Parse git status output
    const lines = status.split('\n').filter(line => line.trim());
    for (const line of lines) {
      // Extract lecture number from filename like "lecture_5.pdf"
      const match = line.match(/lecture[_\s-](\d+)\.pdf/i);
      if (match) {
        lectures.push(match[1]);
      }
    }

    return lectures.sort((a, b) => parseInt(a) - parseInt(b));
  } catch (error) {
    return [];
  }
}

/**
 * Configure git user and push changes to GitHub
 */
async function commitAndPush(updatedCount: number): Promise<void> {
  console.log('\n📤 Preparing to commit and push changes...\n');

  // Check if there are changes to commit
  if (!hasChangesToCommit()) {
    console.log('ℹ️  No changes to commit - repository is up to date');
    return;
  }

  try {
    // Configure git user
    console.log('🔧 Configuring git user...');
    execGit(`git config user.name "${CONFIG.GIT_USER_NAME}"`, { silent: true });
    execGit(`git config user.email "${CONFIG.GIT_USER_EMAIL}"`, { silent: true });
    console.log(`  ✓ User: ${CONFIG.GIT_USER_NAME} <${CONFIG.GIT_USER_EMAIL}>`);

    // Get changed lectures for commit message
    const changedLectures = getChangedLectures();
    let commitMessage = 'Automated sync: ';

    if (changedLectures.length > 0) {
      if (changedLectures.length === 1) {
        commitMessage += `Update slides for lecture ${changedLectures[0]}`;
      } else if (changedLectures.length <= 3) {
        commitMessage += `Update slides for lectures ${changedLectures.join(', ')}`;
      } else {
        commitMessage += `Update slides for ${changedLectures.length} lectures`;
      }
    } else {
      commitMessage += `Update course content (${updatedCount} items)`;
    }

    // Stage changes
    console.log('\n📝 Staging changes...');
    execGit('git add public/slides/* src/app/data/lectureData.ts', { silent: true });
    console.log('  ✓ Staged: public/slides/* and lectureData.ts');

    // Create commit
    console.log('\n💾 Creating commit...');
    execGit(`git commit -m "${commitMessage}"`, { silent: false });
    console.log(`  ✓ Commit created: "${commitMessage}"`);

    // Get current branch
    const currentBranch = execGit('git rev-parse --abbrev-ref HEAD', { silent: true });
    console.log(`\n🌿 Current branch: ${currentBranch}`);

    // Push to remote
    console.log('\n🚀 Pushing to GitHub...');

    if (CONFIG.GITHUB_TOKEN) {
      // Use GITHUB_TOKEN for authentication (CI/CD)
      console.log('  Using GITHUB_TOKEN for authentication');

      // Get remote URL
      const remoteUrl = execGit('git config --get remote.origin.url', { silent: true });
      let repoUrl = remoteUrl;

      // Convert SSH URL to HTTPS if needed
      if (repoUrl.startsWith('git@github.com:')) {
        repoUrl = repoUrl.replace('git@github.com:', 'https://github.com/');
      }

      // Remove .git suffix if present
      repoUrl = repoUrl.replace(/\.git$/, '');

      // Add token to URL
      const authenticatedUrl = repoUrl.replace(
        'https://github.com/',
        `https://x-access-token:${CONFIG.GITHUB_TOKEN}@github.com/`
      );

      // Push with authenticated URL
      execGit(`git push ${authenticatedUrl} ${currentBranch}`, { silent: false });
    } else {
      // Use default git authentication (local)
      console.log('  Using default git authentication');
      execGit(`git push origin ${currentBranch}`, { silent: false });
    }

    console.log('\n✅ Successfully pushed changes to GitHub!');
  } catch (error: any) {
    console.error('\n❌ Failed to commit and push changes:', error.message);
    console.error('\nTroubleshooting:');
    console.error('  - Ensure you have git configured and authenticated');
    console.error('  - For CI/CD, ensure GITHUB_TOKEN is set in environment');
    console.error('  - Check that you have push permissions to the repository');
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Course Content Sync Script\n');
  console.log('================================\n');

  if (shouldSyncSlides) {
    console.log('📚 Slides sync: ENABLED');
  }
  if (shouldSyncRecordings) {
    console.log('🎥 Recordings sync: ENABLED');
  }
  if (shouldPush) {
    console.log('📤 Git push: ENABLED');
  }
  console.log('');

  let slidesMap: Map<number, string> | null = null;
  let recordingsMap: Map<number, string> | null = null;
  let hasErrors = false;

  // Sync slides if enabled
  if (shouldSyncSlides) {
    try {
      slidesMap = await syncSlides();
    } catch (error: any) {
      console.error('\n⚠️  Slides sync encountered an error but continuing...\n');
      hasErrors = true;
    }
  }

  // Get all lectures for recordings matching
  const lectureGroups = parseLectureData();
  const allLectures: Lecture[] = lectureGroups.flatMap(group => group.lectures);

  // Sync recordings if enabled
  if (shouldSyncRecordings) {
    try {
      recordingsMap = await syncRecordings(allLectures);
    } catch (error: any) {
      console.error('\n⚠️  Recordings sync encountered an error but continuing...\n');
      hasErrors = true;
    }
  }

  // Update lecture data file with whatever succeeded
  let updatedCount = 0;
  if (slidesMap || recordingsMap) {
    try {
      updateLectureData(slidesMap, recordingsMap);
      updatedCount = (slidesMap?.size || 0) + (recordingsMap?.size || 0);
    } catch (error: any) {
      console.error('\n❌ Failed to update lectureData.ts:', error.message);
      hasErrors = true;
    }
  }

  // Commit and push if requested and no errors occurred
  if (shouldPush && !hasErrors) {
    try {
      await commitAndPush(updatedCount);
    } catch (error: any) {
      console.error('\n⚠️  Push failed, but sync was successful');
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.log('\n⚠️  Sync completed with some errors. Check output above for details.\n');
    process.exit(1);
  } else {
    console.log('\n✨ Sync completed successfully!\n');
  }
}

// Run the script
main();
