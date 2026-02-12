#!/usr/bin/env ts-node

/**
 * Lecture Recordings Sync Script
 *
 * This script synchronizes lecture recordings from a Google Sheet:
 * - Reads the "Lecture Recordings" spreadsheet from Google Drive
 * - Matches recordings to lectures by date
 * - Updates lectureData.ts with recording links and titles
 * - Does not overwrite existing data if already populated
 * - Optionally commits and pushes changes to GitHub
 *
 * Usage:
 *   npm run sync:recordings              # Sync recordings from sheet
 *   npm run sync:recordings -- --push    # Sync recordings and push to GitHub
 */

import * as fs from 'fs';
import * as path from 'path';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
const CONFIG = {
  GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID,
  GOOGLE_SERVICE_ACCOUNT_PATH: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON, // Base64 encoded JSON for CI/CD
  LECTURE_DATA_PATH: path.join(process.cwd(), 'src', 'app', 'data', 'lectureData.ts'),
  // Git configuration
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GIT_USER_NAME: process.env.GIT_USER_NAME || 'Course Automation',
  GIT_USER_EMAIL: process.env.GIT_USER_EMAIL || 'automation@cs1470.com',
  // Sheet configuration
  RECORDINGS_SHEET_NAME: 'Lecture Recordings',
};

// Parse command line arguments
const args = process.argv.slice(2);
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

interface SheetRecording {
  date: string;
  title: string;
  recordingLink: string;
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
        scopes: [
          'https://www.googleapis.com/auth/drive.readonly',
          'https://www.googleapis.com/auth/spreadsheets.readonly',
        ],
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
      scopes: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly',
      ],
    });
  }
  else {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_PATH or GOOGLE_SERVICE_ACCOUNT_JSON in environment');
  }

  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });
  console.log('✅ Google Drive and Sheets clients initialized');
  return { drive, sheets };
}

/**
 * Find the "Lecture Recordings" spreadsheet in the Google Drive folder
 */
async function findRecordingsSheet(drive: any): Promise<string> {
  console.log('📊 Looking for "Lecture Recordings" spreadsheet...');

  if (!CONFIG.GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error('Missing GOOGLE_DRIVE_FOLDER_ID in .env.local');
  }

  try {
    const response = await drive.files.list({
      q: `'${CONFIG.GOOGLE_DRIVE_FOLDER_ID}' in parents and name='${CONFIG.RECORDINGS_SHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      fields: 'files(id, name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = response.data.files || [];

    if (files.length === 0) {
      throw new Error(`"${CONFIG.RECORDINGS_SHEET_NAME}" spreadsheet not found in the Google Drive folder`);
    }

    const sheetId = files[0].id;
    console.log(`✅ Found spreadsheet: ${files[0].name} (ID: ${sheetId})`);
    return sheetId;
  } catch (error: any) {
    console.error('❌ Failed to find recordings spreadsheet:', error.message);
    throw error;
  }
}

/**
 * Read recordings from the Google Sheet
 * Expected columns: "Lecture Date", "Lecture Name", "Lecture Recording Link"
 */
async function readRecordingsSheet(sheets: any, spreadsheetId: string): Promise<SheetRecording[]> {
  console.log('📖 Reading recordings from Google Sheet...');

  try {
    // Read all data from the first sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'A:C', // Columns A, B, C (Date, Name, Link)
    });

    const rows = response.data.values || [];

    if (rows.length === 0) {
      console.log('⚠️  Sheet is empty');
      return [];
    }

    // Assume first row is header
    const header = rows[0];
    console.log(`  Column headers: ${header.join(', ')}`);

    const recordings: SheetRecording[] = [];

    // Process data rows (skip header)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      if (row.length < 3) {
        console.log(`  ⊘ Skipped row ${i + 1}: incomplete data`);
        continue;
      }

      const date = row[0]?.trim();
      const title = row[1]?.trim();
      const recordingLink = row[2]?.trim();

      // Skip rows with missing required data
      if (!date || !title || !recordingLink) {
        console.log(`  ⊘ Skipped row ${i + 1}: missing required data`);
        continue;
      }

      // Parse and normalize the date
      const parsedDate = parseDate(date);
      if (!parsedDate) {
        console.log(`  ⊘ Skipped row ${i + 1}: invalid date "${date}"`);
        continue;
      }

      recordings.push({
        date: parsedDate,
        title,
        recordingLink,
      });

      console.log(`  ✓ Row ${i + 1}: ${parsedDate} - ${title}`);
    }

    console.log(`\n✅ Read ${recordings.length} recordings from sheet`);
    return recordings;
  } catch (error: any) {
    console.error('❌ Failed to read Google Sheet:', error.message);
    throw error;
  }
}

/**
 * Parse various date formats and return ISO format (YYYY-MM-DD)
 * Supports formats like:
 * - "2026-01-21" (ISO)
 * - "1/21/2026" (US format)
 * - "01/21/2026" (US format with leading zeros)
 * - "Jan 21, 2026" (text format)
 */
function parseDate(dateStr: string): string | null {
  try {
    // Try parsing as Date object
    const date = new Date(dateStr);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return null;
    }

    // Convert to ISO format (YYYY-MM-DD)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    return null;
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
 * Match sheet recordings to lectures and update lectureData
 * Only updates if the field is empty or missing
 */
function updateLectureDataFromSheet(sheetRecordings: SheetRecording[]): number {
  console.log('\n💾 Updating lectureData.ts from sheet recordings...\n');

  const lectureGroups = parseLectureData();
  const allLectures: Lecture[] = lectureGroups.flatMap(group => group.lectures);

  let updatedCount = 0;

  for (const recording of sheetRecordings) {
    // Find lecture with matching date
    const matchingLecture = allLectures.find(lecture => lecture.date === recording.date);

    if (!matchingLecture) {
      console.log(`  ⊘ No lecture found for date ${recording.date} - skipping`);
      continue;
    }

    let updated = false;

    // Update title only if empty or "To Be Announced" or missing
    const shouldUpdateTitle =
      !matchingLecture.title ||
      matchingLecture.title === 'To Be Announced' ||
      matchingLecture.title.trim() === '';

    if (shouldUpdateTitle && recording.title) {
      matchingLecture.title = recording.title;
      console.log(`  ✓ Updated title for Lecture ${matchingLecture.id}: "${recording.title}"`);
      updated = true;
    }

    // Update recording link only if empty or missing
    const shouldUpdateRecording =
      !matchingLecture.recordingLink ||
      matchingLecture.recordingLink.trim() === '';

    if (shouldUpdateRecording && recording.recordingLink) {
      matchingLecture.recordingLink = recording.recordingLink;
      console.log(`  ✓ Updated recording link for Lecture ${matchingLecture.id}`);
      updated = true;
    }

    if (!updated) {
      console.log(`  ⊙ Lecture ${matchingLecture.id} (${recording.date}) already has data - skipped`);
    } else {
      updatedCount++;
    }
  }

  if (updatedCount === 0) {
    console.log('  ℹ️  No updates needed - all data is already current');
    return 0;
  }

  // Write updated data back to file
  const output = `// lecturesData.ts
import { LectureGroup } from "../types";

export const lectureGroups: LectureGroup[] = ${JSON.stringify(lectureGroups, null, 2)};
`;

  fs.writeFileSync(CONFIG.LECTURE_DATA_PATH, output, 'utf-8');
  console.log(`\n✅ Updated ${updatedCount} lectures in lectureData.ts`);

  return updatedCount;
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

    const commitMessage = `Automated sync: Update lecture recordings and names (${updatedCount} items)`;

    // Stage changes
    console.log('\n📝 Staging changes...');
    execGit('git add src/app/data/lectureData.ts', { silent: true });
    console.log('  ✓ Staged: lectureData.ts');

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

      // Pull latest remote changes before pushing to avoid non-fast-forward rejection
      console.log('  Pulling latest remote changes (rebase)...');
      execGit(`git pull --rebase ${authenticatedUrl} ${currentBranch}`, { silent: false });

      // Push with authenticated URL
      execGit(`git push ${authenticatedUrl} ${currentBranch}`, { silent: false });
    } else {
      // Use default git authentication (local)
      console.log('  Using default git authentication');
      execGit(`git pull --rebase origin ${currentBranch}`, { silent: false });
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
  console.log('🚀 Lecture Recordings Sync Script\n');
  console.log('================================\n');

  if (shouldPush) {
    console.log('📤 Git push: ENABLED');
  }
  console.log('');

  let hasErrors = false;
  let updatedCount = 0;

  try {
    // Initialize Google Drive and Sheets clients
    const { drive, sheets } = await initGoogleDrive();

    // Find the recordings spreadsheet
    const spreadsheetId = await findRecordingsSheet(drive);

    // Read recordings from the sheet
    const recordings = await readRecordingsSheet(sheets, spreadsheetId);

    if (recordings.length === 0) {
      console.log('\n⚠️  No recordings found in sheet - nothing to sync');
      return;
    }

    // Update lecture data with recordings
    updatedCount = updateLectureDataFromSheet(recordings);

    // Commit and push if requested and updates were made
    if (shouldPush && updatedCount > 0) {
      try {
        await commitAndPush(updatedCount);
      } catch (error: any) {
        console.error('\n⚠️  Push failed, but sync was successful');
        hasErrors = true;
      }
    }
  } catch (error: any) {
    console.error('\n❌ Sync failed:', error.message);
    hasErrors = true;
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
