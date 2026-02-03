/**
 * Email/SMS Statistics Tracker
 * Tracks sent counts for admin dashboard
 */

// In-memory stats (resets on server restart)
// For persistent stats, use MongoDB
let stats = {
    emails: {
        sent: 0,
        failed: 0,
        pending: 0
    },
    sms: {
        sent: 0,
        failed: 0,
        pending: 0
    },
    calls: {
        sent: 0,
        failed: 0,
        pending: 0,
        completed: 0,
        successEvaluations: {
            true: 0,
            false: 0
        },
        reasons: {}
    },
    sequences: {
        active: 0,
        completed: 0
    },
    lastUpdated: new Date().toISOString(),
    vapiCallDetails: [] // Store last 100 call details
};

// Track sequence progress per contact batch
let activeSequences = new Map();

/**
 * Reset stats
 */
const resetStats = () => {
    stats = {
        emails: { sent: 0, failed: 0, pending: 0 },
        sms: { sent: 0, failed: 0, pending: 0 },
        calls: { 
            sent: 0, 
            failed: 0, 
            pending: 0, 
            completed: 0,
            successEvaluations: { true: 0, false: 0 },
            reasons: {} 
        },
        sequences: { active: 0, completed: 0 },
        vapiCallDetails: [],
        lastUpdated: new Date().toISOString()
    };
    activeSequences.clear();
};

/**
 * Get current stats
 */
const getStats = () => {
    return {
        ...stats,
        lastUpdated: new Date().toISOString()
    };
};

/**
 * Start tracking a sequence
 */
const startSequence = (sequenceId, totalContacts) => {
    activeSequences.set(sequenceId, {
        totalContacts,
        currentEmail: 0,
        emailsSent: 0,
        smsSent: 0,
        callsSent: 0,
        startTime: new Date().toISOString()
    });
    stats.sequences.active++;
    stats.emails.pending += totalContacts * 4; // 4 emails per contact
    stats.sms.pending += totalContacts * 4; // 4 SMS per contact
    stats.calls.pending += totalContacts * 4; // 4 calls per contact
    stats.lastUpdated = new Date().toISOString();
};

/**
 * Update sequence progress
 */
const updateSequenceProgress = (sequenceId, emailNum, emailsSent, smsSent, emailsFailed = 0, smsFailed = 0) => {
    const sequence = activeSequences.get(sequenceId);
    if (sequence) {
        // Update email stats
        const newEmailsSent = emailsSent - sequence.emailsSent;
        if (newEmailsSent > 0) {
            stats.emails.sent += newEmailsSent;
            stats.emails.pending = Math.max(0, stats.emails.pending - newEmailsSent);
        }
        stats.emails.failed += emailsFailed;
        
        // Update SMS stats
        const newSmsSent = smsSent - sequence.smsSent;
        if (newSmsSent > 0) {
            stats.sms.sent += newSmsSent;
            stats.sms.pending = Math.max(0, stats.sms.pending - newSmsSent);
        }
        stats.sms.failed += smsFailed;
        
        sequence.currentEmail = emailNum;
        sequence.emailsSent = emailsSent;
        sequence.smsSent = smsSent;
        stats.lastUpdated = new Date().toISOString();
    }
};

/**
 * Complete a sequence
 */
const completeSequence = (sequenceId) => {
    if (activeSequences.has(sequenceId)) {
        activeSequences.delete(sequenceId);
        stats.sequences.active = Math.max(0, stats.sequences.active - 1);
        stats.sequences.completed++;
        stats.lastUpdated = new Date().toISOString();
    }
};

/**
 * Add email stats directly
 */
const addEmailStats = (sent, failed = 0) => {
    stats.emails.sent += sent;
    stats.emails.failed += failed;
    stats.lastUpdated = new Date().toISOString();
};

/**
 * Add SMS stats directly
 */
const addSmsStats = (sent, failed = 0) => {
    stats.sms.sent += sent;
    stats.sms.failed += failed;
    stats.lastUpdated = new Date().toISOString();
};

/**
 * Add call stats directly
 */
const addCallStats = (sent, failed = 0) => {
    stats.calls.sent += sent;
    stats.calls.failed += failed;
    stats.lastUpdated = new Date().toISOString();
};

/**
 * Set pending counts
 */
const setPending = (emailsPending, smsPending, callsPending = 0) => {
    stats.emails.pending = emailsPending;
    stats.sms.pending = smsPending;
    stats.calls.pending = callsPending;
    stats.lastUpdated = new Date().toISOString();
};

/**
 * Register a VAPI call to track its details
 */
const registerCall = (callId, phoneNumber, name) => {
    if (!callId) return;
    
    // Initialize array if undefined (backward compatibility)
    if (!stats.vapiCallDetails) stats.vapiCallDetails = [];
    
    stats.vapiCallDetails.unshift({
        id: callId,
        phoneNumber,
        name,
        status: 'initiated',
        timestamp: new Date().toISOString()
    });
    
    // Keep last 100 calls
    if (stats.vapiCallDetails.length > 100) {
        stats.vapiCallDetails.pop();
    }
    
    stats.lastUpdated = new Date().toISOString();
};

/**
 * Update VAPI call status from webhook
 */
const updateCallStatus = (callId, status, analysis) => {
    if (!stats.vapiCallDetails) stats.vapiCallDetails = [];
    
    const call = stats.vapiCallDetails.find(c => c.id === callId);
    
    if (call) {
        call.status = status;
        call.analysis = analysis || {};
        call.updatedAt = new Date().toISOString();
        
        // Handle success evaluation updates
        if (analysis) {
            // Check success evaluation
            if (analysis.successEvaluation === 'true' || analysis.successEvaluation === true) {
                // Only increment if not already marked
                if (call.success !== true) {
                    stats.calls.successEvaluations.true++;
                    call.success = true;
                }
            } else if (analysis.successEvaluation === 'false' || analysis.successEvaluation === false) {
                if (call.success !== false) {
                    stats.calls.successEvaluations.false++;
                    call.success = false;
                }
            }
        }
        
        // Handle completion and reasons
        if (status === 'ended') {
            stats.calls.completed++;
            stats.calls.pending = Math.max(0, stats.calls.pending - 1);
            
            const reason = call.analysis.endedReason || 'unknown';
            if (!stats.calls.reasons) stats.calls.reasons = {};
            stats.calls.reasons[reason] = (stats.calls.reasons[reason] || 0) + 1;

            // SPECIAL HANDLING: If call was not picked up or audio issue, count as FAILED
            // User requested: "assistant-did-not-receive-customer-audio" -> Failed
            if (reason === 'assistant-did-not-receive-customer-audio' || reason === 'customer-did-not-answer') {
                 stats.calls.failed++;
            }
        }
    }
    stats.lastUpdated = new Date().toISOString();
};

module.exports = {
    getStats,
    resetStats,
    startSequence,
    updateSequenceProgress,
    completeSequence,
    addEmailStats,
    addSmsStats,
    addCallStats,
    setPending,
    registerCall,
    updateCallStatus,
    stats // Export stats object for direct access if needed
};
