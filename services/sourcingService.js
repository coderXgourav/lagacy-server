const axios = require('axios');
const Candidate = require('../models/Candidate');
const enrichmentService = require('./enrichmentService');

// Apify Configuration
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const APIFY_RUN_ID = process.env.APIFY_RUN_ID || "E7YuqbaDqQb4cFsGo";

/**
 * Worker to source candidates from a specific Apify Run.
 * Fetches the dataset from the run and imports new candidates.
 */
/**
 * Worker to source candidates dynamically via Apify.
 * Triggers a new run for the LinkedIn Scraper Actor based on Job criteria.
 */
exports.sourceCandidatesForJob = async (job) => {
    try {
        console.log(`🤖 Dynamic Sourcing Worker Started for Job: ${job.title} in ${job.location}`);

        // 1. Trigger the Actor Run
        const actorId = "M2FMdjRVeF1HPGFcc"; // The LinkedIn Scraper Actor ID
        const input = {
            "search": job.title,
            "locations": [job.location]
        };

        console.log(`🚀 Triggering Apify Actor ${actorId} with input:`, JSON.stringify(input));
        
        // Start run and wait for it to finish (synchronously for simplicity in this worker)
        // In production, we might want to use webhooks, but 'waitForFinish=120' is good for quick results (up to 2 mins)
        const runResponse = await axios.post(
            `https://api.apify.com/v2/acts/${actorId}/runs?token=${APIFY_TOKEN}&waitForFinish=120`, // Wait up to 120s
            input
        );

        const runData = runResponse.data.data;
        const defaultDatasetId = runData.defaultDatasetId;
        console.log(`✅ Run Finished! Run ID: ${runData.id}, Dataset ID: ${defaultDatasetId}`);

        // 2. Fetch Items from the NEW Dataset
        const itemsResponse = await axios.get(`https://api.apify.com/v2/datasets/${defaultDatasetId}/items?token=${APIFY_TOKEN}`);
        const people = itemsResponse.data || [];

        console.log(`🔍 Found ${people.length} candidates in new dataset.`);

        // 3. Process & Create Candidates
        let createdCount = 0;
        for (const person of people) {
            // Field mapping based on Apify dataset structure (from logs: person.linkedinUrl or person.url)
            const linkedinUrl = person.linkedinUrl || person.url || person.navigationUrl; 
            
            if (!linkedinUrl) continue;

            // Use the name from the scraper, or fallback
            const name = person.fullName || person.title || `${person.firstName || ''} ${person.lastName || ''}`.trim() || job.title;

            // Check if exists
            const existing = await Candidate.findOne({ linkedinUrl: linkedinUrl });
            if (existing) continue;

            // Create Record
            const candidate = new Candidate({
                jobId: job._id,
                name: name,
                linkedinUrl: linkedinUrl,
                status: 'NEW',
                // Headline/Summary filtering is implicitly done by the Scraper's "search" query
                confidenceScore: 0, 
                agentNotes: `Auto-sourced via Apify (Run: ${runData.id})`
            });

            await candidate.save();
            createdCount++;

            // 4. Trigger Enrichment
            enrichmentService.enrichCandidate(candidate._id);
        }

        console.log(`✅ Dynamic Sourcing Complete. Imported ${createdCount} new candidates.`);
        
    } catch (error) {
        console.error("Apify Sourcing Worker Error:", error.message);
        if (error.response) {
            console.error("Apify Error Details:", JSON.stringify(error.response.data, null, 2));
        }
    }
};
