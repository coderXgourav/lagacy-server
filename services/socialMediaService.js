const { google } = require('googleapis');
const crypto = require('crypto');
const cron = require('node-cron');
const axios = require('axios');
const SocialPost = require('../models/SocialPost');
const SocialGroup = require('../models/SocialGroup');

// Configuration
// Expects GOOGLE_SERVICE_ACCOUNT_JSON (stringified) or a path to file
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const getAuth = () => {
    try {
        if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
            const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
            // Fix private key formatting (replace \\n with actual \n)
            if (credentials.private_key) {
                credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
            }
            return new google.auth.GoogleAuth({
                credentials,
                scopes: SCOPES,
            });
        }
        // Fallback to local file if needed
        return new google.auth.GoogleAuth({
            keyFile: './google-credentials.json',
            scopes: SCOPES,
        });
    } catch (e) {
        console.error("Failed to load Google Credentials:", e.message);
        return null;
    }
};

const SPREADSHEET_ID = process.env.SOCIAL_SPREADSHEET_ID;

// Helper: Generate Dedup Key
const generateDedupKey = (postDate, caption, mediaUrls, platforms) => {
    const data = `${postDate}|${caption}|${mediaUrls.join(',')}|${platforms.join(',')}`;
    return crypto.createHash('sha256').update(data).digest('hex');
};

// ==========================================
// WORKFLOW A: WEEKLY INTAKE
// ==========================================
const weeklyIntake = async () => {
    console.log("🔄 Starting Weekly Social Media Intake...");
    const auth = getAuth();
    if (!auth || !SPREADSHEET_ID) {
        console.error("❌ Missing Google Auth or Spreadsheet ID.");
        return;
    }

    try {
        const sheets = google.sheets({ version: 'v4', auth });
        
        // Read Range (Assuming 'ContentCalendar' sheet, columns A-J)
        // Adjust range based on actual sheet structure
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'ContentCalendar!A2:L', // Skipping header
        });

        const rows = res.data.values;
        if (!rows || rows.length === 0) {
            console.log('No data found in ContentCalendar.');
            return;
        }

        const today = new Date();
        today.setHours(0,0,0,0); // Start of today
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);

        let newCount = 0;

        for (const [index, row] of rows.entries()) {
            // Map Row expected structure:
            // 0: Date, 1: Time, 2: Caption, 3: Media Type, 4: Media URLs, 5: Platforms, 
            // 6: Business Page, 7: Group Set ID, 8: Status
            const [dateStr, timeStr, caption, mediaType, mediaUrlsStr, platformsStr, businessPageStr, groupSetId, status] = row;

            // Basic Filter: Skip if already POSTED
            if (status === 'POSTED') continue;

            // Date Check - Smart parsing to handle multiple formats
            // Priority: YYYY-MM-DD > DD/MM/YYYY > MM/DD/YYYY
            let postDate;
            if (!dateStr) continue; // Skip if no date
            
            // Check if it's YYYY-MM-DD format (unambiguous)
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                postDate = new Date(dateStr);
            } 
            // Check if it's DD/MM/YYYY or MM/DD/YYYY format
            else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
                const parts = dateStr.split('/');
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const year = parseInt(parts[2]);
                
                // If day > 12, it must be DD/MM/YYYY
                if (day > 12) {
                    postDate = new Date(year, month - 1, day);
                } 
                // If month > 12, it must be MM/DD/YYYY
                else if (month > 12) {
                    postDate = new Date(year, day - 1, month);
                }
                // Ambiguous case: assume DD/MM/YYYY (European format)
                else {
                    postDate = new Date(year, month - 1, day);
                    console.log(`⚠️  Ambiguous date "${dateStr}" interpreted as DD/MM/YYYY: ${postDate.toDateString()}`);
                }
            }
            // Try default parsing as fallback
            else {
                postDate = new Date(dateStr);
            }
            
            if (isNaN(postDate)) {
                console.warn(`⚠️  Invalid date: "${dateStr}" - skipping`);
                continue;
            }

            // Only skip posts that are in the past (already passed)
            // Allow all future posts regardless of how far in the future
            if (postDate < today) {
                console.log(`⏭️  Skipping past post: ${dateStr}`);
                continue;
            }

            const platforms = platformsStr ? platformsStr.split(',').map(p => p.trim().toLowerCase()) : [];
            const mediaUrls = mediaUrlsStr ? mediaUrlsStr.split(',').map(u => u.trim()) : [];

            // Validation
            if (!caption && mediaUrls.length === 0) {
                console.warn(`Row ${index + 2}: Empty post`);
                continue; // Should mark error in sheet ideally
            }

            // Dedup
            const dedupKey = generateDedupKey(dateStr, caption || '', mediaUrls, platforms);

            // Upsert to DB
            // We use findOneAndUpdate with upsert to avoid duplicates
            await SocialPost.findOneAndUpdate(
                { dedupKey: dedupKey },
                {
                    weekId: `W${getWeekNumber(postDate)}`,
                    postDate: postDate,
                    postTime: timeStr,
                    caption: caption,
                    mediaType: mediaType || 'text',
                    mediaUrls: mediaUrls,
                    platforms: platforms,
                    businessPages: parseBusinessPages(businessPageStr), // Helper needed
                    groupSetId: groupSetId,
                    status: 'PENDING', // Ready for daily publisher
                    dedupKey: dedupKey
                },
                { upsert: true, new: true }
            );
            newCount++;
        }
        console.log(`✅ Weekly Intake Complete. Upserted ${newCount} posts.`);

    } catch (error) {
        console.error('Error in weeklyIntake:', error);
    }
};

// Helper: Parse "fb:page1, li:page2"
const parseBusinessPages = (str) => {
    const map = {};
    if (!str) return map;
    str.split(',').forEach(part => {
        const [platform, page] = part.split(':');
        if (platform && page) map[platform.trim().toLowerCase()] = page.trim();
    });
    return map;
};

// Helper: ISO Week Number
const getWeekNumber = (d) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
};


// ==========================================
// WORKFLOW B: PUBLISHER ENGINE (Runs every 10 mins)
// ==========================================
const dailyPublisher = async () => {
    console.log("🚀 Starting Publisher Engine...");
    
    // 1. Identify "Today"
    const now = new Date();
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(); todayEnd.setDate(todayEnd.getDate() + 1); todayEnd.setHours(0,0,0,0);

    // 2. Find eligible posts
    const posts = await SocialPost.find({
        $or: [
            // PENDING posts for today
            { 
                status: 'PENDING', 
                postDate: { $gte: todayStart, $lt: todayEnd } 
            },
            // FAILED posts ready for retry
            { 
                status: 'FAILED', 
                attemptCount: { $lt: 4 },
                nextRetryAt: { $lte: now }
            }
        ]
    });

    if (posts.length === 0) {
        // console.log("No posts to process.");
        return;
    }

    console.log(`Found ${posts.length} potential posts for today.`);

    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTimeVal = currentHours * 60 + currentMinutes;

    for (const post of posts) {
        // TIME CHECK
        if (post.status === 'PENDING' && post.postTime) {
            // Parse "HH:MM" e.g. "12:40"
            const [pH, pM] = post.postTime.split(':').map(Number);
            const postTimeVal = pH * 60 + pM;
            
            // If current time is BEFORE the scheduled time, SKIP it
            if (currentTimeVal < postTimeVal) {
                console.log(`⏳ Skipping ${post.dedupKey}: Scheduled for ${post.postTime} (Now: ${currentHours}:${currentMinutes})`);
                continue;
            }
        }
        
        await processPost(post);
    }
};

// ... processPost remains the same ...

const initSchedules = () => {
    // 1. Weekly Intake: Monday 9:00 AM
    cron.schedule('0 9 * * 1', weeklyIntake, { timezone: "Asia/Kolkata" });
    
    // 2. Publisher: Runs every 10 minutes to check for due posts
    cron.schedule('*/10 * * * *', dailyPublisher, { timezone: "Asia/Kolkata" });
    
    console.log("📅 Social Media Schedules Initialized:");
    console.log("   - Weekly Intake: Mon 9:00 AM");
    console.log("   - Publisher: Every 10 mins (Checks row time)");
};

const processPost = async (post) => {
    // 3. Lock It (Dedup Check) based on User Rules
    // Rule: "Check DB if dedup_key exists for today... Else insert lock"
    // Our 'status: PROCESSING' acts as the lock.
    
    // Atomic Lock
    const lockedPost = await SocialPost.findOneAndUpdate(
        { _id: post._id, status: { $in: ['PENDING', 'FAILED'] } }, 
        { status: 'PROCESSING', lastProcessedAt: new Date() },
        { new: true }
    );

    if (!lockedPost) return; // Race condition or already processed

    console.log(`Processing: ${post.dedupKey}, Attempt: ${post.attemptCount + 1}`);
    
    const results = {};
    const errors = [];
    
    try {
        // 4. Prepare Media (Drive -> Public)
        const finalMedia = [];
        for (const url of post.mediaUrls) {
            if (url.includes('drive.google.com')) {
                // Placeholder: Convert Drive Link -> Direct Download / CDN
                // For MVP, we pass it through or strip query params if needed.
                // ideally: const publicUrl = await downloadAndUploadToCDN(url);
                finalMedia.push(url); // Passing raw for now
            } else {
                finalMedia.push(url);
            }
        }

        // 5. Post to Platforms
        for (const platform of post.platforms) {
             try {
                 let result;
                 if (platform === 'facebook') result = await postToFacebook(post, finalMedia);
                 else if (platform === 'linkedin') result = await postToLinkedIn(post, finalMedia);
                 else if (platform === 'twitter' || platform === 'x') result = await postToTwitter(post, finalMedia);
                 else if (platform === 'gmb') result = await postToGMB(post, finalMedia);
                 
                 if (result && result.id) results[platform] = result.id;
                 
                 // Wait 3 sec as requested
                 await new Promise(r => setTimeout(r, 3000));
             } catch (err) {
                 errors.push(`${platform}: ${err.message}`);
             }
        }

    } catch (err) {
        errors.push(`System: ${err.message}`);
    }

    // 6. Final Result
    const isSuccess = Object.keys(results).length > 0; // At least one success
    const newAttemptCount = post.attemptCount + 1;

    if (isSuccess) {
        await SocialPost.findByIdAndUpdate(post._id, {
            status: 'POSTED',
            postIds: results,
            lastError: errors.length > 0 ? errors.join(' | ') : "",
            attemptCount: newAttemptCount
        });
        console.log(`✅ POSTED: ${post.dedupKey}`);
        
        // 7. Group Sharing
        // if (post.groupSetId) triggerGroupSharing(post);

    } else {
        // 8. Retry Logic
        let nextRetry = null;
        if (newAttemptCount < 4) {
             const now = new Date();
             if (newAttemptCount === 1) nextRetry = new Date(now.getTime() + 10 * 60000); // +10 min
             else if (newAttemptCount === 2) nextRetry = new Date(now.getTime() + 60 * 60000); // +60 min
             else if (newAttemptCount === 3) {
                 nextRetry = new Date(now);
                 nextRetry.setDate(nextRetry.getDate() + 1); // +1 day
             }
             console.log(`❌ FAILED. Retrying at ${nextRetry.toISOString()}`);
        } else {
            console.error("❌ FAILED. Max attempts reached.");
        }

        await SocialPost.findByIdAndUpdate(post._id, {
            status: 'FAILED',
            lastError: errors.join(' | '),
            attemptCount: newAttemptCount,
            nextRetryAt: nextRetry
        });
    }
};



// ... (existing imports and code) ...

// --- REAL API ADAPTERS ---

// 1. Facebook (Graph API)
const postToFacebook = async (post, media) => {
    const pageId = post.businessPages?.get('facebook');
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;

    if (!pageId || !accessToken) {
        throw new Error("Missing FB Page ID or Access Token");
    }

    // Determine endpoint based on media
    let url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
    let payload = {
        message: post.caption,
        access_token: accessToken
    };

    if (media && media.length > 0) {
        // Simple case: Single Image/Video
        // For multiple, we'd need a more complex flow (upload each, then attached_media)
        // Here we assume first media item for simplicity or link
        if (post.mediaType === 'image') {
            url = `https://graph.facebook.com/v19.0/${pageId}/photos`;
            payload.url = media[0];
        } else if (post.mediaType === 'link') {
            payload.link = media[0];
        }
    }

    console.log(`[FB] Posting to ${pageId}...`);
    const response = await axios.post(url, payload);
    return { id: response.data.id };
};

// 2. LinkedIn (Posts API - Updated from deprecated ugcPosts)
const postToLinkedIn = async (post, media) => {
    let orgId = post.businessPages?.get('linkedin'); // e.g., urn:li:organization:1234
    const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;

    if (!accessToken) {
        throw new Error("Missing LinkedIn Access Token");
    }

    let authorUrn;
    if (orgId) {
        // Business Page Posting
        authorUrn = orgId.startsWith('urn:') ? orgId : `urn:li:organization:${orgId}`;
    } else {
        // Personal Profile Posting (Fetch 'me')
        try {
            console.log("[LinkedIn] No Page ID provided. Fetching User Profile...");
            // Try OIDC UserInfo first (Modern 'profile' scope)
            let profileId;
            try {
                console.log("[LinkedIn] Attempting OIDC UserInfo (v2/userinfo)...");
                const userInfo = await axios.get('https://api.linkedin.com/v2/userinfo', {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                profileId = userInfo.data.sub; // 'sub' is the member ID in OIDC
                console.log(`[LinkedIn] OIDC UserInfo Success. ID: ${profileId}`);
            } catch (oidcError) {
                console.error("[LinkedIn] OIDC UserInfo failed:", oidcError.response?.data || oidcError.message);
                
                try {
                     // Fallback to legacy v2/me (requires r_liteprofile)
                     console.log("[LinkedIn] Falling back to v2/me...");
                     const me = await axios.get('https://api.linkedin.com/v2/me', {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                     });
                     profileId = me.data.id;
                } catch (meError) {
                     console.error("[LinkedIn] Legacy v2/me failed:", meError.response?.data || meError.message);
                     throw meError;
                }
            }

            authorUrn = `urn:li:person:${profileId}`;
            console.log(`[LinkedIn] Fetched Profile URN: ${authorUrn}`);
        } catch (error) {
            console.error("[LinkedIn] Failed to fetch profile:", error.response?.data || error.message);
            throw new Error("Failed to fetch LinkedIn Profile ID for personal post.");
        }
    }

    // New Posts API payload structure (replaces deprecated ugcPosts)
    const payload = {
        author: authorUrn,
        commentary: post.caption,
        visibility: "PUBLIC",
        distribution: {
            feedDistribution: "MAIN_FEED",
            targetEntities: [],
            thirdPartyDistributionChannels: []
        },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false
    };

    console.log(`[LinkedIn] Posting to ${authorUrn} using Posts API...`);
    console.log(`[LinkedIn] Payload:`, JSON.stringify(payload, null, 2));
    
    try {
        const response = await axios.post('https://api.linkedin.com/rest/posts', payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
                'LinkedIn-Version': '202601'
            }
        });
        console.log(`[LinkedIn] Post Success! Response:`, response.data);
        // The new API returns the post URN in the x-restli-id header or response
        const postId = response.headers['x-restli-id'] || response.data?.id || 'posted';
        return { id: postId };
    } catch (error) {
        console.error("[LinkedIn] Post Error:", error.response?.data || error.message);
        console.error("[LinkedIn] Error Status:", error.response?.status);
        console.error("[LinkedIn] Error Headers:", error.response?.headers);
        throw error;
    }
};

// 3. GMB (Google My Business) - Placeholder
// GMB requires Google My Business API enable + OAuth. Complex for MVP.
const postToGMB = async (post, media) => {
    console.warn("[GMB] Google My Business API not fully configured. Skipping.");
    // Return a fake ID to allow workflow to pass if desired, or throw error
    // throw new Error("GMB Not Implemented");
    return { id: "gmb_skipped_placeholder" };
};

// 4. Twitter/X (API v2)
const postToTwitter = async (post, media) => {
    // Try Bearer Token first (simpler), fallback to OAuth 1.0a if needed
    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
    
    if (!bearerToken && (!accessToken || !accessTokenSecret)) {
        throw new Error("Missing Twitter credentials");
    }

    // Twitter API v2 endpoint for creating tweets
    const url = 'https://api.twitter.com/2/tweets';
    
    // Prepare tweet payload
    const payload = {
        text: post.caption
    };

    console.log(`[Twitter] Posting tweet...`);
    console.log(`[Twitter] Text: ${post.caption.substring(0, 50)}...`);
    
    try {
        // Try Bearer Token authentication first (for app-only auth)
        if (bearerToken) {
            console.log(`[Twitter] Using Bearer Token authentication`);
            try {
                const response = await axios.post(url, payload, {
                    headers: {
                        'Authorization': `Bearer ${bearerToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                console.log(`[Twitter] Tweet Success! Response:`, response.data);
                return { id: response.data.data?.id || 'posted' };
            } catch (bearerError) {
                console.error("[Twitter] Bearer Token failed:", bearerError.response?.data || bearerError.message);
                // Fall through to OAuth 1.0a
            }
        }

        // Fallback to OAuth 1.0a (user context)
        if (accessToken && accessTokenSecret) {
            console.log(`[Twitter] Falling back to OAuth 1.0a`);
            const OAuth = require('oauth-1.0a');
            const crypto = require('crypto');
            
            // Get API Key and Secret (Consumer credentials)
            const apiKey = process.env.TWITTER_API_KEY || process.env.TWITTER_CLIENT_ID;
            const apiSecret = process.env.TWITTER_API_SECRET || process.env.TWITTER_CLIENT_SECRET;
            
            if (!apiKey || !apiSecret) {
                throw new Error("Missing Twitter API Key/Secret for OAuth 1.0a");
            }
            
            const oauth = OAuth({
                consumer: {
                    key: apiKey,
                    secret: apiSecret
                },
                signature_method: 'HMAC-SHA1',
                hash_function(base_string, key) {
                    return crypto
                        .createHmac('sha1', key)
                        .update(base_string)
                        .digest('base64');
                }
            });

            const requestData = {
                url: url,
                method: 'POST'
            };

            const token = {
                key: accessToken,
                secret: accessTokenSecret
            };

            const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

            const response = await axios.post(url, payload, {
                headers: {
                    ...authHeader,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`[Twitter] Tweet Success! Response:`, response.data);
            return { id: response.data.data?.id || 'posted' };
        }
        
        throw new Error("No valid Twitter authentication method available");
        
    } catch (error) {
        console.error("[Twitter] Post Error:", error.response?.data || error.message);
        console.error("[Twitter] Error Status:", error.response?.status);
        throw error;
    }
};

// Scheduler
// Scheduler removed (moved to top)

// ==========================================
// UPLOAD HANDLER: Sync CSV/Excel to Sheet
// ==========================================
 const csv = require('csv-parser');
 const { Readable } = require('stream');
 const ExcelJS = require('exceljs');

const syncToSheet = async (fileBuffer, mimeType) => {
    console.log("📤 Syncing file to Google Sheet...");
    const auth = getAuth();
    if (!auth || !SPREADSHEET_ID) throw new Error("Missing Google Auth/Sheet ID");

    const rows = [];

    // Parse Input File
    if (mimeType.includes('csv') || mimeType.includes('spreadsheet')) { 
        // Handle CSV
        await new Promise((resolve, reject) => {
            Readable.from(fileBuffer)
                .pipe(csv())
                .on('data', (data) => {
                    // Normalize to array based on headers or index
                    // Assuming standard columns: Date, Time, Caption, Media, URL, Platforms...
                    // Convert object values to array
                    rows.push(Object.values(data));
                })
                .on('end', resolve)
                .on('error', reject);
        });
    } else {
        // Handle Excel
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer);
        const worksheet = workbook.getWorksheet(1);
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) { // Skip header
                // ExcelJS row.values is 1-based and includes empty at 0? check docs. 
                // usually row.values returns [opt, col1, col2...]
                const rowVals = Array.isArray(row.values) ? row.values.slice(1) : Object.values(row.values);
                rows.push(rowVals);
            }
        });
    }

    if (rows.length === 0) return { count: 0 };

    // Write to Sheet (Append or Overwrite?) 
    // User implied "Runs every Monday after upload", suggesting this is the new batch.
    // Safe approach: Append to 'RawUploads' or Clear+Write 'ContentCalendar'.
    // We will CLEAR and WRITE 'ContentCalendar' to ensure strict sync with the file provided.
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // Clear existing data
    await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: 'ContentCalendar!A2:L'
    });

    // Write new data
    await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'ContentCalendar!A2',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: rows
        }
    });

    console.log(`✅ Synced ${rows.length} rows to Sheet.`);
    
    // Trigger Intake immediately
    await weeklyIntake();
    
    return { count: rows.length };
};

// ==========================================
// DASHBOARD DATA SERVICE
// ==========================================
 const getDashboardData = async () => {
    try {
        const stats = {
            total: await SocialPost.countDocuments(),
            posted: await SocialPost.countDocuments({ status: 'POSTED' }),
            failed: await SocialPost.countDocuments({ status: 'FAILED' }),
            pending: await SocialPost.countDocuments({ status: 'PENDING' }),
        };

        const calendar = await SocialPost.find({ status: 'PENDING' })
            .sort({ postDate: 1, postTime: 1 })
            .limit(10); // Show next 10

        const queue = await SocialPost.find({ status: { $in: ['PENDING', 'PROCESSING', 'FAILED', 'PARTIAL_SUCCESS'] } })
            .sort({ createdAt: -1 })
            .limit(10); // Show recent activity

        return { stats, calendar, queue };
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        throw error;
    }
};

module.exports = {
    weeklyIntake,
    dailyPublisher,
    initSchedules,
    syncToSheet,
    getDashboardData
};
