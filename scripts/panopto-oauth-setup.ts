#!/usr/bin/env ts-node

/**
 * Panopto OAuth2 Setup Script with PKCE
 *
 * This script performs OAuth2 authorization code flow with PKCE to obtain
 * a refresh token for Panopto API access. The refresh token is saved to .env.local
 * and can be used by sync-course-content.ts to obtain access tokens without
 * requiring username/password.
 *
 * Flow:
 * 1. Generate PKCE code verifier and challenge
 * 2. Start local web server on http://localhost:3000
 * 3. Open browser to Panopto authorization URL
 * 4. User logs in via Brown's SSO (Shibboleth)
 * 5. Capture authorization code from redirect
 * 6. Exchange code for access token and refresh token
 * 7. Save refresh token to .env.local
 *
 * Usage:
 *   npm run panopto-auth
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as http from 'http';
import { URLSearchParams } from 'url';
import axios from 'axios';
import * as dotenv from 'dotenv';

// Dynamic imports for ESM modules
let express: any;
let open: any;

async function loadModules() {
  express = (await import('express')).default;
  open = (await import('open')).default;
}

// Load environment variables
dotenv.config({ path: '.env.local' });

// Configuration
const CONFIG = {
  PANOPTO_BASE_URL: 'https://brown.hosted.panopto.com/Panopto',
  PANOPTO_CLIENT_ID: process.env.PANOPTO_CLIENT_ID,
  PANOPTO_CLIENT_SECRET: process.env.PANOPTO_CLIENT_SECRET,
  REDIRECT_URI: 'http://localhost:3000/callback',
  SCOPE: 'api',
  PORT: 3000,
  ENV_FILE_PATH: path.join(process.cwd(), '.env.local'),
};

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * Generate a random string for PKCE code verifier
 */
function generateCodeVerifier(): string {
  return crypto
    .randomBytes(32)
    .toString('base64url');
}

/**
 * Generate PKCE code challenge from verifier
 */
function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

/**
 * Generate a random state parameter for CSRF protection
 */
function generateState(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Build the authorization URL
 */
function buildAuthorizationUrl(
  codeChallenge: string,
  state: string
): string {
  const params = new URLSearchParams({
    client_id: CONFIG.PANOPTO_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: CONFIG.REDIRECT_URI,
    scope: CONFIG.SCOPE,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  return `${CONFIG.PANOPTO_BASE_URL}/oauth2/connect/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<TokenResponse> {
  console.log('🔄 Exchanging authorization code for tokens...');

  try {
    const response = await axios.post<TokenResponse>(
      `${CONFIG.PANOPTO_BASE_URL}/oauth2/connect/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: CONFIG.REDIRECT_URI,
        code_verifier: codeVerifier,
      }),
      {
        auth: {
          username: CONFIG.PANOPTO_CLIENT_ID!,
          password: CONFIG.PANOPTO_CLIENT_SECRET!,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log('✅ Successfully obtained tokens');
    return response.data;
  } catch (error: any) {
    console.error('❌ Token exchange failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Save refresh token to .env.local
 */
function saveRefreshToken(refreshToken: string): void {
  console.log('💾 Saving refresh token to .env.local...');

  let envContent = '';

  // Read existing .env.local if it exists
  if (fs.existsSync(CONFIG.ENV_FILE_PATH)) {
    envContent = fs.readFileSync(CONFIG.ENV_FILE_PATH, 'utf-8');
  }

  // Check if PANOPTO_REFRESH_TOKEN already exists
  const refreshTokenRegex = /^PANOPTO_REFRESH_TOKEN=.*$/m;

  if (refreshTokenRegex.test(envContent)) {
    // Replace existing refresh token
    envContent = envContent.replace(
      refreshTokenRegex,
      `PANOPTO_REFRESH_TOKEN=${refreshToken}`
    );
  } else {
    // Add new refresh token
    // Add it after the Panopto section if it exists, otherwise at the end
    const panoptoSectionEnd = envContent.indexOf('\n\n# Google Drive');

    if (panoptoSectionEnd !== -1) {
      envContent =
        envContent.slice(0, panoptoSectionEnd) +
        `\nPANOPTO_REFRESH_TOKEN=${refreshToken}` +
        envContent.slice(panoptoSectionEnd);
    } else {
      // Just append to the end
      if (!envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += `PANOPTO_REFRESH_TOKEN=${refreshToken}\n`;
    }
  }

  fs.writeFileSync(CONFIG.ENV_FILE_PATH, envContent, 'utf-8');
  console.log('✅ Refresh token saved successfully');
}

/**
 * Start local web server and handle OAuth flow
 */
async function startOAuthFlow(): Promise<void> {
  await loadModules();

  // Validate configuration
  if (!CONFIG.PANOPTO_CLIENT_ID || !CONFIG.PANOPTO_CLIENT_SECRET) {
    throw new Error('Missing PANOPTO_CLIENT_ID or PANOPTO_CLIENT_SECRET in .env.local');
  }

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  console.log('🚀 Starting Panopto OAuth2 Setup\n');
  console.log('================================\n');

  // Build authorization URL
  const authUrl = buildAuthorizationUrl(codeChallenge, state);

  return new Promise((resolve, reject) => {
    const app = express();
    let server: http.Server;

    // Callback route
    app.get('/callback', async (req: any, res: any) => {
      const { code, state: returnedState, error, error_description } = req.query;

      // Check for errors
      if (error) {
        const errorMsg = `Authorization failed: ${error} - ${error_description}`;
        console.error(`❌ ${errorMsg}`);
        res.send(`
          <html>
            <body>
              <h1>❌ Authorization Failed</h1>
              <p>${errorMsg}</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
        server.close();
        reject(new Error(errorMsg));
        return;
      }

      // Validate state parameter
      if (returnedState !== state) {
        const errorMsg = 'State mismatch - possible CSRF attack';
        console.error(`❌ ${errorMsg}`);
        res.send(`
          <html>
            <body>
              <h1>❌ Security Error</h1>
              <p>${errorMsg}</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
        server.close();
        reject(new Error(errorMsg));
        return;
      }

      // Check if code was received
      if (!code) {
        const errorMsg = 'No authorization code received';
        console.error(`❌ ${errorMsg}`);
        res.send(`
          <html>
            <body>
              <h1>❌ Error</h1>
              <p>${errorMsg}</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
        server.close();
        reject(new Error(errorMsg));
        return;
      }

      console.log('✅ Authorization code received');

      try {
        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code as string, codeVerifier);

        // Check if refresh token was returned
        if (!tokens.refresh_token) {
          throw new Error('No refresh token returned by Panopto');
        }

        // Save refresh token
        saveRefreshToken(tokens.refresh_token);

        // Send success response
        res.send(`
          <html>
            <body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
              <h1 style="color: #22c55e;">✅ Authorization Successful!</h1>
              <p>Your refresh token has been saved to <code>.env.local</code></p>
              <p>You can now close this window and use <code>npm run sync</code> to sync course content.</p>
              <hr style="margin: 30px 0;">
              <p style="color: #666; font-size: 14px;">
                <strong>Note:</strong> The refresh token will be used automatically by the sync script.
                You don't need to re-authenticate unless the refresh token expires.
              </p>
            </body>
          </html>
        `);

        console.log('\n✨ OAuth2 setup completed successfully!\n');
        console.log('You can now run: npm run sync\n');

        // Close server after a delay
        setTimeout(() => {
          server.close();
          resolve();
        }, 1000);

      } catch (error: any) {
        console.error('❌ Failed to complete OAuth flow:', error.message);
        res.send(`
          <html>
            <body>
              <h1>❌ Token Exchange Failed</h1>
              <p>${error.message}</p>
              <p>Check the console for more details.</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);
        server.close();
        reject(error);
      }
    });

    // Start server
    server = app.listen(CONFIG.PORT, async () => {
      console.log(`🌐 Local server started on http://localhost:${CONFIG.PORT}`);
      console.log('📝 Opening browser for authorization...\n');
      console.log('Please log in with your Brown credentials in the browser.\n');

      try {
        await open(authUrl);
      } catch (error: any) {
        console.log('⚠️  Could not open browser automatically.');
        console.log('Please open this URL manually:\n');
        console.log(authUrl);
        console.log('');
      }
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      reject(error);
    });
  });
}

/**
 * Main execution function
 */
async function main() {
  try {
    await startOAuthFlow();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ OAuth setup failed:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
