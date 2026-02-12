#!/usr/bin/env ts-node

/**
 * Sync Slides and Recordings from Slack Channel
 *
 * Polls a shared Slack group DM/channel for new content:
 * - PDF file attachments → uploads to Google Drive as lecture_N.pdf,
 *   updates lectureData.ts slidesLink
 * - Messages starting with "recording: <url>" → updates lectureData.ts
 *   recordingLink for the next missing lecture
 *
 * Processed message timestamps are stored in scripts/slack-sync-state.json
 * to prevent duplicate processing across runs.
 *
 * Usage:
 *   npm run sync:slides:from-slack          # Poll and process
 *   npm run sync:slides:from-slack -- --push # Poll, process, and push to GitHub
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { Readable } from 'stream';
import { google } from 'googleapis';
import { WebClient } from '@slack/web-api';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
const CONFIG = {
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
  SLACK_CHANNEL_ID: process.env.SLACK_CHANNEL_ID,
  GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID,
  GOOGLE_SERVICE_ACCOUNT_PATH: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
  GOOGLE_SERVICE_ACCOUNT_JSON: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
  LECTURE_DATA_PATH: path.join(process.cwd(), 'src', 'app', 'data', 'lectureData.ts'),
  STATE_FILE_PATH: path.join(process.cwd(), 'scripts', 'slack-sync-state.json'),
  // Git configuration
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GIT_USER_NAME: process.env.GIT_USER_NAME || 'Course Automation',
  GIT_USER_EMAIL: process.env.GIT_USER_EMAIL || 'automation@cs1470.com',
};

// Parse command line arguments
const args = process.argv.slice(2);
const shouldPush = args.includes('--push');

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface SyncState {
  processedMessageTimestamps: string[];
}

// ─── State file ───────────────────────────────────────────────────────────────

function loadState(): SyncState {
  try {
    if (fs.existsSync(CONFIG.STATE_FILE_PATH)) {
      const raw = fs.readFileSync(CONFIG.STATE_FILE_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {
    console.warn('⚠️  Could not read state file, starting fresh');
  }
  return { processedMessageTimestamps: [] };
}

function saveState(state: SyncState): void {
  fs.writeFileSync(CONFIG.STATE_FILE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf-8');
  console.log('  ✓ State file updated');
}

// ─── Google Drive ─────────────────────────────────────────────────────────────

async function initGoogleDrive() {
  console.log('🔐 Initializing Google Drive client...');

  let auth;

  if (CONFIG.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.log('  Using base64 encoded service account credentials (CI/CD mode)');
    try {
      const decodedJson = Buffer.from(CONFIG.GOOGLE_SERVICE_ACCOUNT_JSON, 'base64').toString('utf-8');
      const credentials = JSON.parse(decodedJson);
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });
    } catch (error: any) {
      throw new Error(`Failed to parse base64 encoded service account JSON: ${error.message}`);
    }
  } else if (CONFIG.GOOGLE_SERVICE_ACCOUNT_PATH) {
    console.log('  Using service account file path (local mode)');
    if (!fs.existsSync(CONFIG.GOOGLE_SERVICE_ACCOUNT_PATH)) {
      throw new Error(`Service account file not found: ${CONFIG.GOOGLE_SERVICE_ACCOUNT_PATH}`);
    }
    auth = new google.auth.GoogleAuth({
      keyFile: CONFIG.GOOGLE_SERVICE_ACCOUNT_PATH,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
  } else {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_PATH or GOOGLE_SERVICE_ACCOUNT_JSON in environment');
  }

  const drive = google.drive({ version: 'v3', auth });
  console.log('✅ Google Drive client initialized');
  return drive;
}

async function listDrivePDFs(drive: any): Promise<any[]> {
  console.log('📄 Listing existing PDF files from Google Drive...');

  if (!CONFIG.GOOGLE_DRIVE_FOLDER_ID) {
    throw new Error('Missing GOOGLE_DRIVE_FOLDER_ID in environment');
  }

  const response = await drive.files.list({
    q: `'${CONFIG.GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType='application/pdf' and trashed=false`,
    fields: 'files(id, name, size)',
    orderBy: 'name',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = response.data.files || [];
  console.log(`✅ Found ${files.length} existing PDF files in Google Drive`);
  return files;
}

async function uploadToDrive(drive: any, pdfBuffer: Buffer, lectureId: number): Promise<void> {
  const filename = `lecture_${lectureId}.pdf`;
  console.log(`  ⬆️  Uploading ${filename} to Google Drive...`);

  await drive.files.create({
    requestBody: {
      name: filename,
      parents: [CONFIG.GOOGLE_DRIVE_FOLDER_ID!],
      mimeType: 'application/pdf',
    },
    media: {
      mimeType: 'application/pdf',
      body: Readable.from(pdfBuffer),
    },
    supportsAllDrives: true,
    fields: 'id, name',
  });

  console.log(`  ✓ Uploaded: ${filename}`);
}

// ─── Lecture data ─────────────────────────────────────────────────────────────

function parseLectureData(): LectureGroup[] {
  const fileContent = fs.readFileSync(CONFIG.LECTURE_DATA_PATH, 'utf-8');
  const match = fileContent.match(/export const lectureGroups: LectureGroup\[\] = (\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error('Could not parse lectureGroups from lectureData.ts');
  }
  // eslint-disable-next-line no-eval
  return eval(match[1]);
}

function writeLectureData(lectureGroups: LectureGroup[]): void {
  const output = `// lecturesData.ts
import { LectureGroup } from "../types";

export const lectureGroups: LectureGroup[] = ${JSON.stringify(lectureGroups, null, 2)};
`;
  fs.writeFileSync(CONFIG.LECTURE_DATA_PATH, output, 'utf-8');
}

/** Returns the id of the next lecture missing a slidesLink, or null if all are set. */
function getNextMissingSlideId(existingDriveFiles: any[]): number | null {
  const lectureGroups = parseLectureData();
  const allLectures: Lecture[] = lectureGroups.flatMap(g => g.lectures).sort((a, b) => a.id - b.id);

  // Build set of lecture IDs already on Drive (belt-and-suspenders check)
  const uploadedIds = new Set<number>();
  for (const f of existingDriveFiles) {
    const m = f.name.match(/lecture[_\s-](\d+)\.pdf/i);
    if (m) uploadedIds.add(parseInt(m[1], 10));
  }

  for (const lecture of allLectures) {
    const alreadyUploaded = uploadedIds.has(lecture.id);
    const hasSlideLink = lecture.slidesLink && lecture.slidesLink.trim() !== '';
    if (!hasSlideLink && !alreadyUploaded) {
      return lecture.id;
    }
  }
  return null;
}

/** Returns the id of the next lecture missing a recordingLink, or null if all are set. */
function getNextMissingRecordingId(): number | null {
  const lectureGroups = parseLectureData();
  const allLectures: Lecture[] = lectureGroups.flatMap(g => g.lectures).sort((a, b) => a.id - b.id);
  for (const lecture of allLectures) {
    if (!lecture.recordingLink || lecture.recordingLink.trim() === '') {
      return lecture.id;
    }
  }
  return null;
}

function updateSlidesLink(lectureId: number, slidesLink: string): void {
  const lectureGroups = parseLectureData();
  let updated = false;
  for (const group of lectureGroups) {
    for (const lecture of group.lectures) {
      if (lecture.id === lectureId) {
        lecture.slidesLink = slidesLink;
        updated = true;
      }
    }
  }
  if (updated) {
    writeLectureData(lectureGroups);
    console.log(`  ✓ Updated slidesLink for Lecture ${lectureId}: ${slidesLink}`);
  }
}

function updateRecordingLink(lectureId: number, recordingLink: string): void {
  const lectureGroups = parseLectureData();
  let updated = false;
  for (const group of lectureGroups) {
    for (const lecture of group.lectures) {
      if (lecture.id === lectureId) {
        lecture.recordingLink = recordingLink;
        updated = true;
      }
    }
  }
  if (updated) {
    writeLectureData(lectureGroups);
    console.log(`  ✓ Updated recordingLink for Lecture ${lectureId}`);
  }
}

// ─── Slack ────────────────────────────────────────────────────────────────────

interface SlackFile {
  id: string;
  name: string;
  filetype?: string;
  mimetype?: string;
  url_private_download?: string;
}

interface ProcessedMessages {
  pdfMessages: Array<{ ts: string; file: SlackFile }>;
  recordingMessages: Array<{ ts: string; url: string }>;
}

async function fetchUnprocessedMessages(
  slack: WebClient,
  processedTimestamps: string[]
): Promise<ProcessedMessages> {
  console.log('💬 Fetching messages from Slack channel...');

  const processed = new Set(processedTimestamps);
  const pdfMessages: ProcessedMessages['pdfMessages'] = [];
  const recordingMessages: ProcessedMessages['recordingMessages'] = [];

  const response = await slack.conversations.history({
    channel: CONFIG.SLACK_CHANNEL_ID!,
    limit: 50,
  });

  const messages = (response.messages || []).filter(
    (m: any) => m.ts && !processed.has(m.ts)
  );

  // Sort ascending (oldest first) so we process in order
  messages.sort((a: any, b: any) => parseFloat(a.ts) - parseFloat(b.ts));

  for (const msg of messages) {
    // Check for PDF attachments
    if (msg.files && Array.isArray(msg.files)) {
      for (const file of msg.files as SlackFile[]) {
        if (
          file.filetype === 'pdf' ||
          (file.mimetype && file.mimetype.includes('pdf'))
        ) {
          pdfMessages.push({ ts: msg.ts!, file });
          break; // Only take the first PDF per message
        }
      }
    }

    // Check for recording link (message text starts with "recording:")
    if (msg.text) {
      const match = (msg.text as string).match(/^recording:\s*(\S+)/i);
      if (match) {
        recordingMessages.push({ ts: msg.ts!, url: match[1] });
      }
    }
  }

  console.log(`  Found ${pdfMessages.length} new PDF message(s), ${recordingMessages.length} new recording link(s)`);
  return { pdfMessages, recordingMessages };
}

function downloadSlackFile(file: SlackFile): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const url = file.url_private_download;
    if (!url) {
      return reject(new Error(`No url_private_download for file: ${file.name}`));
    }

    const options = {
      headers: {
        Authorization: `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
      },
    };

    https.get(url, options, (res) => {
      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, options, (res2) => {
          const chunks: Buffer[] = [];
          res2.on('data', (chunk: Buffer) => chunks.push(chunk));
          res2.on('end', () => resolve(Buffer.concat(chunks)));
          res2.on('error', reject);
        }).on('error', reject);
        return;
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Slack file download failed with status ${res.statusCode}: ${file.name}`));
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

// ─── Git ──────────────────────────────────────────────────────────────────────

function execGit(command: string, options?: { silent?: boolean }): string {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: options?.silent ? 'pipe' : 'inherit',
    });
    return result ? result.trim() : '';
  } catch (error: any) {
    throw new Error(`Git command failed: ${command}\n${error.message}`);
  }
}

function hasChangesToCommit(): boolean {
  try {
    const status = execGit('git status --porcelain', { silent: true });
    return status.length > 0;
  } catch {
    console.error('⚠️  Could not check git status');
    return false;
  }
}

async function commitAndPush(slidesCount: number, recordingsCount: number): Promise<void> {
  console.log('\n📤 Preparing to commit and push changes...\n');

  if (!hasChangesToCommit()) {
    console.log('ℹ️  No changes to commit - repository is up to date');
    return;
  }

  try {
    execGit(`git config user.name "${CONFIG.GIT_USER_NAME}"`, { silent: true });
    execGit(`git config user.email "${CONFIG.GIT_USER_EMAIL}"`, { silent: true });
    console.log(`  ✓ Git user: ${CONFIG.GIT_USER_NAME} <${CONFIG.GIT_USER_EMAIL}>`);

    const parts: string[] = [];
    if (slidesCount > 0) parts.push(`${slidesCount} slide(s)`);
    if (recordingsCount > 0) parts.push(`${recordingsCount} recording(s)`);
    const commitMessage = `Automated sync: Slack import - ${parts.join(', ')}`;

    execGit('git add src/app/data/lectureData.ts scripts/slack-sync-state.json', { silent: true });
    console.log('  ✓ Staged: lectureData.ts, slack-sync-state.json');

    execGit(`git commit -m "${commitMessage}"`, { silent: false });
    console.log(`  ✓ Commit created: "${commitMessage}"`);

    const currentBranch = execGit('git rev-parse --abbrev-ref HEAD', { silent: true });
    console.log(`\n🌿 Current branch: ${currentBranch}`);

    console.log('\n🚀 Pushing to GitHub...');

    if (CONFIG.GITHUB_TOKEN) {
      const remoteUrl = execGit('git config --get remote.origin.url', { silent: true });
      let repoUrl = remoteUrl;
      if (repoUrl.startsWith('git@github.com:')) {
        repoUrl = repoUrl.replace('git@github.com:', 'https://github.com/');
      }
      repoUrl = repoUrl.replace(/\.git$/, '');
      const authenticatedUrl = repoUrl.replace(
        'https://github.com/',
        `https://x-access-token:${CONFIG.GITHUB_TOKEN}@github.com/`
      );

      console.log('  Pulling latest remote changes (rebase)...');
      execGit(`git pull --rebase ${authenticatedUrl} ${currentBranch}`, { silent: false });
      execGit(`git push ${authenticatedUrl} ${currentBranch}`, { silent: false });
    } else {
      execGit(`git pull --rebase origin ${currentBranch}`, { silent: false });
      execGit(`git push origin ${currentBranch}`, { silent: false });
    }

    console.log('\n✅ Successfully pushed changes to GitHub!');
  } catch (error: any) {
    console.error('\n❌ Failed to commit and push changes:', error.message);
    throw error;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('🤖 Slack → Course Content Sync\n');

  // Validate required env vars
  const missing: string[] = [];
  if (!CONFIG.SLACK_BOT_TOKEN) missing.push('SLACK_BOT_TOKEN');
  if (!CONFIG.SLACK_CHANNEL_ID) missing.push('SLACK_CHANNEL_ID');
  if (!CONFIG.GOOGLE_DRIVE_FOLDER_ID) missing.push('GOOGLE_DRIVE_FOLDER_ID');
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Load dedup state
  const state = loadState();
  console.log(`📋 State: ${state.processedMessageTimestamps.length} previously processed message(s)\n`);

  // Fetch unprocessed messages from Slack
  const slack = new WebClient(CONFIG.SLACK_BOT_TOKEN);
  const { pdfMessages, recordingMessages } = await fetchUnprocessedMessages(slack, state.processedMessageTimestamps);

  if (pdfMessages.length === 0 && recordingMessages.length === 0) {
    console.log('\nℹ️  No new content found in Slack channel. Nothing to do.');
    return;
  }

  let slidesUploaded = 0;
  let recordingsUpdated = 0;

  // ── Process PDF attachments (slides) ──
  if (pdfMessages.length > 0) {
    console.log('\n📚 Processing PDF slides...\n');

    const drive = await initGoogleDrive();
    let existingDriveFiles = await listDrivePDFs(drive);

    for (const { ts, file } of pdfMessages) {
      const lectureId = getNextMissingSlideId(existingDriveFiles);
      if (lectureId === null) {
        console.warn('⚠️  No lectures with missing slidesLink found — skipping remaining PDFs');
        break;
      }

      console.log(`\n📎 Processing slide for Lecture ${lectureId}: ${file.name}`);

      try {
        const pdfBuffer = await downloadSlackFile(file);
        console.log(`  ✓ Downloaded from Slack (${Math.round(pdfBuffer.length / 1024)} KB)`);

        await uploadToDrive(drive, pdfBuffer, lectureId);

        // Update in-memory drive file list so next iteration sees the upload
        existingDriveFiles = [...existingDriveFiles, { name: `lecture_${lectureId}.pdf` }];

        updateSlidesLink(lectureId, `slides/lecture_${lectureId}.pdf`);

        state.processedMessageTimestamps.push(ts);
        slidesUploaded++;
      } catch (error: any) {
        console.error(`  ✗ Failed to process slide from message ${ts}:`, error.message);
        // Don't mark as processed so it can be retried next run
      }
    }
  }

  // ── Process recording links ──
  if (recordingMessages.length > 0) {
    console.log('\n🎥 Processing recording links...\n');

    for (const { ts, url } of recordingMessages) {
      const lectureId = getNextMissingRecordingId();
      if (lectureId === null) {
        console.warn('⚠️  No lectures with missing recordingLink found — skipping remaining recording messages');
        break;
      }

      console.log(`\n🔗 Recording link for Lecture ${lectureId}: ${url}`);

      try {
        updateRecordingLink(lectureId, url);
        state.processedMessageTimestamps.push(ts);
        recordingsUpdated++;
      } catch (error: any) {
        console.error(`  ✗ Failed to update recording for message ${ts}:`, error.message);
      }
    }
  }

  // Save dedup state
  console.log('\n💾 Saving state...');
  saveState(state);

  console.log(`\n✅ Done: ${slidesUploaded} slide(s) uploaded, ${recordingsUpdated} recording(s) updated`);

  // Commit and push if requested
  if (shouldPush && (slidesUploaded > 0 || recordingsUpdated > 0)) {
    await commitAndPush(slidesUploaded, recordingsUpdated);
  } else if (shouldPush) {
    console.log('\nℹ️  Nothing new to push.');
  }
}

main().catch((error) => {
  console.error('\n💥 Fatal error:', error.message);
  process.exit(1);
});
