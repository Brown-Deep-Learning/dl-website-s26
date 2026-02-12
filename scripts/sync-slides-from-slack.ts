#!/usr/bin/env ts-node

/**
 * Sync Slides and Recordings from Slack Channel
 *
 * Polls a shared Slack group DM/channel for new content:
 * - PDF file attachments → downloads and saves to public/slides/ as lecture_N.pdf,
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
import { WebClient } from '@slack/web-api';
import * as dotenv from 'dotenv';
import { execSync } from 'child_process';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
const CONFIG = {
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
  SLACK_CHANNEL_ID: process.env.SLACK_CHANNEL_ID,
  SLIDES_DIR: path.join(process.cwd(), 'public', 'slides'),
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

// ─── Local Slides ─────────────────────────────────────────────────────────────

/** List existing lecture PDF files in public/slides/ */
function listLocalSlides(): string[] {
  console.log('📄 Listing existing PDF files in public/slides/...');

  if (!fs.existsSync(CONFIG.SLIDES_DIR)) {
    fs.mkdirSync(CONFIG.SLIDES_DIR, { recursive: true });
    console.log('  Created public/slides/ directory');
  }

  const files = fs.readdirSync(CONFIG.SLIDES_DIR)
    .filter(f => f.endsWith('.pdf'));

  console.log(`✅ Found ${files.length} existing PDF files in public/slides/`);
  return files;
}

/** Save a PDF buffer to public/slides/lecture_N.pdf */
function saveSlideLocally(pdfBuffer: Buffer, lectureId: number): string {
  const filename = `lecture_${lectureId}.pdf`;
  const filepath = path.join(CONFIG.SLIDES_DIR, filename);
  console.log(`  💾 Saving ${filename} to public/slides/...`);

  fs.writeFileSync(filepath, pdfBuffer);

  console.log(`  ✓ Saved: ${filepath}`);
  return filename;
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
function getNextMissingSlideId(existingLocalFiles: string[]): number | null {
  const lectureGroups = parseLectureData();
  const allLectures: Lecture[] = lectureGroups.flatMap(g => g.lectures).sort((a, b) => a.id - b.id);

  // Build set of lecture IDs already saved locally (belt-and-suspenders check)
  const uploadedIds = new Set<number>();
  for (const f of existingLocalFiles) {
    const m = f.match(/lecture[_\s-](\d+)\.pdf/i);
    if (m) uploadedIds.add(parseInt(m[1], 10));
  }

  for (const lecture of allLectures) {
    const alreadyExists = uploadedIds.has(lecture.id);
    const hasSlideLink = lecture.slidesLink && lecture.slidesLink.trim() !== '';
    if (!hasSlideLink && !alreadyExists) {
      return lecture.id;
    }
  }
  return null;
}

/** Returns the id of the next lecture missing a recordingLink, or null if all are set.
 *  Lecture 1 is always skipped (intro lecture, no recording needed). */
function getNextMissingRecordingId(): number | null {
  const lectureGroups = parseLectureData();
  const allLectures: Lecture[] = lectureGroups.flatMap(g => g.lectures).sort((a, b) => a.id - b.id);
  for (const lecture of allLectures) {
    if (lecture.id === 1) continue; // Lecture 1 is skipped by design
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
        // Slack auto-wraps URLs in angle brackets: <https://...> — strip them
        const url = match[1].replace(/^<|>$/g, '');
        recordingMessages.push({ ts: msg.ts!, url });
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

    execGit('git add src/app/data/lectureData.ts scripts/slack-sync-state.json public/slides/', { silent: true });
    console.log('  ✓ Staged: lectureData.ts, slack-sync-state.json, public/slides/');

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

    let existingLocalFiles = listLocalSlides();

    for (const { ts, file } of pdfMessages) {
      const lectureId = getNextMissingSlideId(existingLocalFiles);
      if (lectureId === null) {
        console.warn('⚠️  No lectures with missing slidesLink found — skipping remaining PDFs');
        break;
      }

      console.log(`\n📎 Processing slide for Lecture ${lectureId}: ${file.name}`);

      try {
        const pdfBuffer = await downloadSlackFile(file);
        console.log(`  ✓ Downloaded from Slack (${Math.round(pdfBuffer.length / 1024)} KB)`);

        saveSlideLocally(pdfBuffer, lectureId);

        // Update in-memory file list so next iteration sees the new file
        existingLocalFiles = [...existingLocalFiles, `lecture_${lectureId}.pdf`];

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
