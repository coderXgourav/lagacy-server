const express = require('express');
const router = express.Router();
const { sendBulkEmails, sendEmailSequence, EMAIL_TEMPLATES } = require('../services/emailService');
const { SMS_TEMPLATES } = require('../services/smsService');
const { getStats, resetStats, startSequence, completeSequence } = require('../services/statsService');
const authMiddleware = require('../middleware/auth');
const Reply = require('../models/Reply');

/**
 * GET /api/csv-uploader/stats
 * Get email/SMS statistics for admin dashboard
 */
router.get('/stats', authMiddleware, (req, res) => {
    try {
        const stats = getStats();
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/csv-uploader/stats/reset
 * Reset all statistics
 */
router.post('/stats/reset', authMiddleware, (req, res) => {
    try {
        resetStats();
        res.json({
            success: true,
            message: 'Statistics reset successfully'
        });
    } catch (error) {
        console.error('Error resetting stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/csv-uploader/send-emails
 * Send single batch of emails (original functionality)
 */
router.post('/send-emails', authMiddleware, async (req, res) => {
    try {
        const { contacts, subject, body } = req.body;
        
        if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No contacts provided' 
            });
        }
        
        if (!subject || !body) {
            return res.status(400).json({ 
                success: false, 
                error: 'Subject and body are required' 
            });
        }
        
        // Check AWS SES configuration
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            return res.status(500).json({ 
                success: false, 
                error: 'Email service is not configured. Please set AWS SES credentials in environment variables.' 
            });
        }
        
        console.log(`Sending emails to ${contacts.length} contacts...`);
        
        const results = await sendBulkEmails(contacts, subject, body);
        
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        
        // Update stats
        addEmailStats(successCount, failCount);
        
        console.log(`Email sending complete: ${successCount} sent, ${failCount} failed`);
        
        res.json({
            success: true,
            summary: {
                total: contacts.length,
                sent: successCount,
                failed: failCount
            },
            results
        });
        
    } catch (error) {
        console.error('Error sending emails:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * POST /api/csv-uploader/send-sequence
 * Send 4-email sequence with 2-minute delays
 * This runs in the background and sends immediate response
 */
router.post('/send-sequence', authMiddleware, async (req, res) => {
    try {
        const { contacts, subject, body, delayMinutes = 2 } = req.body;
        
        if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'No contacts provided' 
            });
        }
        
        if (!subject || !body) {
            return res.status(400).json({ 
                success: false, 
                error: 'Subject and body are required' 
            });
        }
        
        // Check AWS SES configuration
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            return res.status(500).json({ 
                success: false, 
                error: 'Email service is not configured. Please set AWS SES credentials in environment variables.' 
            });
        }
        
        console.log(`Starting email sequence for ${contacts.length} contacts with ${delayMinutes} minute delays...`);
        
        // Start tracking this sequence
        const sequenceId = Date.now().toString();
        startSequence(sequenceId, contacts.length);
        
        // Send immediate response - sequence runs in background
        res.json({
            success: true,
            message: `Email sequence started! 4 emails + 4 SMS will be sent to ${contacts.length} contacts with ${delayMinutes} minute delays between each.`,
            totalEmails: contacts.length * 4,
            totalSms: contacts.length * 4,
            estimatedCompletion: `${delayMinutes * 3} minutes`,
            sequenceId
        });
        
        // Run sequence in background (don't await) - stats are updated in emailService
        sendEmailSequence(contacts, subject, body, delayMinutes)
            .then(results => {
                const emailsSent = [
                    results.email1.filter(r => r.success).length,
                    results.email2.filter(r => r.success).length,
                    results.email3.filter(r => r.success).length,
                    results.email4.filter(r => r.success).length
                ].reduce((a, b) => a + b, 0);
                
                const smsSent = [
                    results.sms1.filter(r => r.success).length,
                    results.sms2.filter(r => r.success).length,
                    results.sms3.filter(r => r.success).length,
                    results.sms4.filter(r => r.success).length
                ].reduce((a, b) => a + b, 0);
                
                // Complete sequence tracking (stats already updated in emailService)
                completeSequence(sequenceId);
                
                console.log(`Sequence complete! Emails: ${emailsSent} sent, SMS: ${smsSent} sent`);
            })
            .catch(error => {
                console.error('Error in email sequence:', error);
                completeSequence(sequenceId);
            });
        
    } catch (error) {
        console.error('Error starting email sequence:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * GET /api/csv-uploader/config-status
 * Check if email service is configured
 */
router.get('/config-status', authMiddleware, (req, res) => {
    const isConfigured = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    res.json({ 
        configured: isConfigured,
        provider: 'AWS SES',
        region: process.env.AWS_REGION || 'us-east-1'
    });
});

// Get all templates
router.get('/templates', authMiddleware, (req, res) => {
    try {
        res.json({
            success: true,
            templates: {
                emails: EMAIL_TEMPLATES,
                sms: SMS_TEMPLATES
            }
        });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch templates' });
    }
});

// Get all replies (Inbox)
router.get('/replies', authMiddleware, async (req, res) => {
    try {
        const replies = await Reply.find().sort({ timestamp: -1 }).limit(100);
        res.json({
            success: true,
            replies
        });
    } catch (error) {
        console.error('Error fetching replies:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch replies' });
    }
});

module.exports = router;
