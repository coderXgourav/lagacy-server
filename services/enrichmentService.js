const axios = require('axios');
const Candidate = require('../models/Candidate');

// Placeholder for Apollo API Key
const APOLLO_API_KEY = process.env.APOLLO_API_KEY;

// Free domain list for validation
const FREE_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com'];

exports.enrichCandidate = async (candidateId) => {
    try {
        const candidate = await Candidate.findById(candidateId);
        if (!candidate) return;

        console.log(`🔎 Enrichment Started: ${candidate.name}`);
        console.time(`Enrichment-${candidateId}`);
        
        // STATUS -> ENRICHING
        await Candidate.findByIdAndUpdate(candidateId, { status: 'ENRICHING' });

        // 1. Split name into first/last for better accuracy
        const nameParts = candidate.name.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

        // 2. Call Apollo /v1/people/match
        console.time(`Apollo-Match-${candidateId}`);
        const response = await axios.post('https://api.apollo.io/v1/people/match', {
            api_key: APOLLO_API_KEY,
            linkedin_url: candidate.linkedinUrl,
            first_name: firstName,
            last_name: lastName,
            reveal_personal_emails: true // Ensure we try to get emails
        });
        console.timeEnd(`Apollo-Match-${candidateId}`);

        const person = response.data?.person;

        if (person) {
            // --- VALIDATION LOGIC ---
            let status = 'READY';
            let rejectionReason = null;
            let notes = "Enrichment successful.";

            // A. Email fetching & Validation
            const email = person.email || (person.personal_emails && person.personal_emails[0]) || null;
            
            // Rule: Email confidence < 70% (Apollo doesn't always give score per email in match, but we check existence)
            // If email is missing, we treat it as low confidence/failure for this workflow
            if (!email) {
                status = 'REJECTED';
                rejectionReason = 'No email found';
            }

            // Rule: Free domain check
            if (email) {
                const domain = email.split('@')[1];
                if (FREE_DOMAINS.includes(domain)) {
                    status = 'REJECTED';
                    rejectionReason = 'Free domain email (Gmail/Yahoo etc)';
                }
            }

            // Rule: Missing company
            const companyName = person.organization?.name;
            if (status !== 'REJECTED' && !companyName) {
                status = 'REJECTED';
                rejectionReason = 'Missing company data';
            }

            // Prepare Data
            const enrichedData = {
                email: email,
                phone: person.phone_numbers && person.phone_numbers[0] ? person.phone_numbers[0].sanitized_number : null,
                companyData: {
                    name: companyName,
                    domain: person.organization?.primary_domain,
                    industry: person.organization?.industry,
                    employees: person.organization?.estimated_num_employees,
                    website: person.organization?.website_url
                },
                confidenceScore: 90, // We assume high confidence if Apollo returns a match
                status: status,
                rejectionReason: rejectionReason,
                agentNotes: rejectionReason ? `Auto-rejected: ${rejectionReason}` : notes
            };

            await Candidate.findByIdAndUpdate(candidateId, { $set: enrichedData });
            console.log(`✅ Enrichment Complete. Status: ${status}`);
            console.timeEnd(`Enrichment-${candidateId}`);

        } else {
            // Rule: Apollo fails -> NEEDS_REVIEW
            console.warn(`⚠️ Apollo: No match found for ${candidate.name}`);
            await Candidate.findByIdAndUpdate(candidateId, {
                status: 'NEEDS_REVIEW',
                confidenceScore: 10,
                agentNotes: "Apollo could not find a match. Manual review required."
            });
            console.timeEnd(`Enrichment-${candidateId}`);
        }

    } catch (error) {
        console.error("Enrichment Service Error:", error.message);
        if (error.response && error.response.data) {
            console.error("Apollo API Error Details:", JSON.stringify(error.response.data, null, 2));
        }

        // Rule: Apollo fails (Systems error) -> NEEDS_REVIEW
        await Candidate.findByIdAndUpdate(candidateId, {
            status: 'NEEDS_REVIEW',
            agentNotes: `System Error: ${error.message}`
        });
        console.timeEnd(`Enrichment-${candidateId}`);
    }
};
