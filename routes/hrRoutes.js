const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const axios = require('axios');

const enrichmentService = require('../services/enrichmentService');
const sourcingService = require('../services/sourcingService');

// Helper to normalize LinkedIn URL
const normalizeLinkedInUrl = (url) => {
    if (!url) return '';
    
    // Support standard profiles and Sales Navigator URLs
    const linkedinRegex = /linkedin\.com\/(in|sales|profile|people)\//;
    if (!linkedinRegex.test(url)) {
        throw new Error("Invalid LinkedIn URL format");
    }

    try {
        // Remove query parameters and trailing slashes
        let normalized = url.split('?')[0].replace(/\/$/, "");
        // Ensure https
        if (!normalized.startsWith('http')) {
            normalized = `https://${normalized.includes('linkedin.com') ? normalized : 'www.linkedin.com/in/' + normalized}`;
        }
        // Lowercase for consistent deduping
        return normalized.toLowerCase();
    } catch (e) {
        return url;
    }
};

// =======================
// JOB ENDPOINTS
// =======================

const crypto = require('crypto');

// Create Job Request
router.post('/jobs', async (req, res) => {
    try {
        const jobData = {
            ...req.body,
            batchId: crypto.randomBytes(4).toString('hex').toUpperCase() // 8-char hex
        };

        const job = new Job(jobData);
        await job.save();

        // TRIGGER SOURCING WORKER
        // This runs in background to find and create candidates
        sourcingService.sourceCandidatesForJob(job);

        res.status(201).json(job);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all Jobs (with optional status filter)
router.get('/jobs', async (req, res) => {
    try {
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        const jobs = await Job.find(filter).sort({ createdAt: -1 });
        res.json(jobs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// =======================
// CANDIDATE ENDPOINTS
// =======================

// Add a new Candidate to a Job
router.post('/candidates', async (req, res) => {
    try {
        // 1. Normalize URL
        const rawUrl = req.body.linkedinUrl;
        const normalizedUrl = normalizeLinkedInUrl(rawUrl);

        // 2. CHECK IF EXISTS (SKIP LOGIC)
        const existingCandidate = await Candidate.findOne({ linkedinUrl: normalizedUrl });
        if (existingCandidate) {
            console.log(`⏩ Candidate exists, SKIPPING: ${normalizedUrl}`);
            return res.status(200).json({ 
                message: "Candidate already exists", 
                skipped: true, 
                candidate: existingCandidate 
            });
        }

        const candidateData = {
            ...req.body,
            linkedinUrl: normalizedUrl
        };

        const candidate = new Candidate(candidateData);
        await candidate.save();

        // 3. Trigger Enrichment (Async)
        enrichmentService.enrichCandidate(candidate._id);

        res.status(201).json(candidate);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get Candidates for a specific Job (or all if no query)
router.get('/candidates', async (req, res) => {
    try {
        const filter = {};
        if (req.query.jobId) filter.jobId = req.query.jobId;
        if (req.query.status) filter.status = req.query.status;
        
        const candidates = await Candidate.find(filter)
            .populate('jobId', 'title')
            .sort({ createdAt: -1 });
            
        res.json(candidates);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Candidate Status (e.g., triggering LINKEDIN_SENT)
router.patch('/candidates/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const candidate = await Candidate.findByIdAndUpdate(
            req.params.id, 
            { status }, 
            { new: true }
        );

        if (!candidate) return res.status(404).json({ error: 'Candidate not found' });

        // WEBHOOK TRIGGER: If status is LINKEDIN_SENT
        if (status === 'LINKEDIN_SENT') {
            try {
                // Example webhook trigger (replace with actual user-defined URL if needed)
                // await axios.post('https://external-webhook.com', candidate);
                console.log(`🚀 Webhook Triggered for Candidate: ${candidate.name} (${candidate._id})`);
            } catch (err) {
                console.error("Webhook failed", err);
            }
        }

        res.json(candidate);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Bulk Add Candidates
router.post('/candidates/bulk', async (req, res) => {
    try {
        const { jobId, urls } = req.body; // urls is an array of strings
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ error: "Invalid URLs format" });
        }

        const results = {
            created: 0,
            skipped: 0,
            errors: 0
        };

        for (const rawUrl of urls) {
            try {
                if (!rawUrl.trim()) continue;
                const normalizedUrl = normalizeLinkedInUrl(rawUrl.trim());
                
                // Check exists
                const existing = await Candidate.findOne({ linkedinUrl: normalizedUrl });
                if (existing) {
                    results.skipped++;
                    continue;
                }

                // Create new
                const candidate = new Candidate({
                    jobId,
                    linkedinUrl: normalizedUrl,
                    name: "Applicant", // Placeholder
                    status: 'NEW'
                });
                await candidate.save();
                
                // Trigger Enrichment
                enrichmentService.enrichCandidate(candidate._id);
                results.created++;
            } catch (err) {
                console.error(`Bulk Import Error for ${rawUrl}:`, err.message);
                results.errors++;
            }
        }

        res.json({ message: "Bulk import complete", ...results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Candidate
router.delete('/candidates/:id', async (req, res) => {
    try {
        const candidate = await Candidate.findByIdAndDelete(req.params.id);
        if (!candidate) return res.status(404).json({ error: 'Candidate not found' });
        res.json({ message: 'Candidate deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
