const express = require('express');
const router = express.Router();
const { updateCallStatus } = require('../services/statsService');

/**
 * POST /api/webhooks/vapi
 * Handle incoming VAPI webhooks
 */
const Reply = require('../models/Reply');

/**
 * POST /api/webhooks/vapi
 * Handle incoming VAPI webhooks
 */
router.post('/vapi', (req, res) => {
    // ... (existing vapi handling code)
    try {
        console.log('🐞 VAPI Webhook Hit! Body:', JSON.stringify(req.body, null, 2));
        const { message } = req.body;
        
        // Log incoming webhook for debugging
        console.log('Received VAPI webhook:', message?.type);

        if (!message) {
            return res.status(400).json({ error: 'No message in body' });
        }

        // Handle End of Call Report
        if (message.type === 'end-of-call-report') {
            const { call, analysis, endedReason } = message;
            
            if (call && call.id) {
                console.log(`Processing End of Call Report for ${call.id}`);
                
                // Construct status update
                const status = 'ended';
                const callAnalysis = {
                    ...analysis,
                    endedReason: endedReason || message.endedReason
                };
                
                // Update stats service
                updateCallStatus(call.id, status, callAnalysis);
            }
        }
        
        // Handle call status updates
        if (message.type === 'status-update') {
            if (message.call && message.call.id) {
                updateCallStatus(message.call.id, message.status);
            }
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error handling VAPI webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/webhooks/email-reply
 * Handle incoming Email replies
 */
router.post('/email-reply', async (req, res) => {
    try {
        console.log('Received Email webhook:', req.body);
        
        // Extract fields (adapt based on webhook provider like SES/SendGrid)
        // This is a generic handler
        const { from, to, subject, text, html } = req.body;
        
        if (!from) {
             return res.status(400).json({ error: 'Missing sender' });
        }
        
        const reply = new Reply({
            type: 'email',
            from,
            to: to || 'system',
            subject: subject || 'No Subject',
            content: text || html || 'No Content',
            timestamp: new Date()
        });
        
        await reply.save();
        console.log('Saved new email reply:', reply._id);
        
        res.status(200).json({ success: true, id: reply._id });
    } catch (error) {
        console.error('Error handling Email webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/webhooks/sms-reply
 * Handle incoming SMS replies
 */
router.post('/sms-reply', async (req, res) => {
    try {
        console.log('Received SMS webhook:', req.body);
        
        // Extract fields (adapt based on provider like Twilio/SNS)
        const { From, To, Body } = req.body;
        
        if (!From || !Body) {
             return res.status(400).json({ error: 'Missing sender or body' });
        }
        
        const reply = new Reply({
            type: 'sms',
            from: From,
            to: To || 'system',
            content: Body,
            timestamp: new Date()
        });
        
        await reply.save();
        console.log('Saved new SMS reply:', reply._id);
        
        res.status(200).json({ success: true, id: reply._id });
    } catch (error) {
        console.error('Error handling SMS webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
