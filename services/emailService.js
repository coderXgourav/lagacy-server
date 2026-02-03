const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { sendBulkSMS } = require('./smsService');
const { addEmailStats, addSmsStats, addCallStats, setPending } = require('./statsService');
const { makeBulkVapiCalls } = require('./vapiService');

// Create SES client
const createSESClient = () => {
    return new SESClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });
};

// Email templates for the sequence
const EMAIL_TEMPLATES = [
    // Email 1 - Quick System Check (already the default in frontend)
    null, // Will use the template from frontend
    
    // Email 2 - One mistake that kills B2B growth
    {
        subject: "{{name}} — one mistake that silently kills B2B growth",
        body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>One mistake that silently kills B2B growth</title>
<style>
body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
body { margin: 0; padding: 0; width: 100% !important; background-color: #f4f7f6; font-family: Helvetica, Arial, sans-serif; }
@media screen and (max-width:600px){ .mobile-width{width:100%!important} .mobile-padding{padding:20px!important} }
</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;">
<tr>
<td align="center" style="padding:40px 10px;">
<table width="600" class="mobile-width" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,.05);overflow:hidden;">
<tr><td height="6" style="background:#0056b3"></td></tr>
<tr>
<td align="center" style="padding:40px 40px 25px;border-bottom:1px solid #eeeeee;">
<a href="https://kyptronix.us" target="_blank"><img src="https://media.designrush.com/agencies/325222/conversions/Kyptronix-logo-profile.jpg" width="180" alt="Kyptronix Logo" style="display:block;"></a>
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:25px;">
<tr>
<td align="center">
<a href="https://kyptronix.us/about-us" style="color:#555555;text-decoration:none;font-size:13px;font-weight:bold;padding:0 10px;text-transform:uppercase;letter-spacing:.5px;">About</a>
<span style="color:#e0e0e0;">|</span>
<a href="https://kyptronix.us/services" style="color:#555555;text-decoration:none;font-size:13px;font-weight:bold;padding:0 10px;text-transform:uppercase;letter-spacing:.5px;">Services</a>
<span style="color:#e0e0e0;">|</span>
<a href="https://kyptronix.us/package-and-pricing" style="color:#555555;text-decoration:none;font-size:13px;font-weight:bold;padding:0 10px;text-transform:uppercase;letter-spacing:.5px;">Packages</a>
<span style="color:#e0e0e0;">|</span>
<a href="https://kyptronix.us/portfolio" style="color:#555555;text-decoration:none;font-size:13px;font-weight:bold;padding:0 10px;text-transform:uppercase;letter-spacing:.5px;">Portfolio</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td class="mobile-padding" style="padding:40px 50px;color:#374151;font-size:16px;line-height:1.6;">
<h1 style="margin:0 0 20px;font-size:22px;color:#1F2937;">Hi {{name}},</h1>
<p>Most teams think they need more leads.<br>They don't.</p>
<p style="font-weight:bold; color:#0056b3;">They need less friction between interest and action.</p>
<p>What we see in audits:</p>
<ul style="padding-left:18px;margin:0 0 20px;">
<li style="margin-bottom:8px;">Forms that go nowhere</li>
<li style="margin-bottom:8px;">No instant response</li>
<li style="margin-bottom:8px;">No lead scoring</li>
<li style="margin-bottom:8px;">No follow-up logic</li>
</ul>
<p>So the lead cools off.<br>Sales blames marketing.<br>Marketing blames traffic.</p>
<p>The fix is boring.<br>That's why it works.</p>
<p style="margin-bottom:30px;">If you want, I'll send you the exact checklist we use to diagnose this.</p>
<table cellpadding="0" cellspacing="0">
<tr>
<td style="background:#0056b3;border-radius:50px;">
<a href="https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ1kzqqp92tBVNRFyNSo_sdyCg68VzzRMbv947cCXtze9o3lML1qr7B-xhYMp8myDqwLR4vbhrr2" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-weight:bold;text-decoration:none;">Get the Checklist</a>
</td>
</tr>
</table>
<p style="margin-top:30px;">—<br><strong>Souvik Karmakar</strong><br>CEO, Kyptronix LLP</p>
<p style="font-size:14px;color:#4B5563;">+1 (302) 219-6889 (USA)<br>+91 91238 37577 (IND)<br><a href="https://kyptronix.us" style="color:#0056b3;text-decoration:none;">kyptronix.us</a></p>
<p style="font-size:13px;color:#6B7280;">651 N Broad St, Middletown, DE 19709, USA</p>
</td>
</tr>
<tr>
<td align="center" style="background-color:#2c3e50; background-image:linear-gradient(135deg,#2c3e50 0%,#0056b3 100%); padding:40px 30px;">
<h2 style="margin:0 0 15px;color:#ffffff;font-size:22px;">Ready to fix your growth system?</h2>
<p style="margin:0 0 25px;color:#e0e0e0;font-size:14px;line-height:1.5;max-width:420px;">Kyptronix LLP designs automation systems that capture, qualify, and convert leads — without manual chaos.</p>
<table cellpadding="0" cellspacing="0">
<tr>
<td style="background:#ffffff;border-radius:50px;">
<a href="https://kyptronix.us/contact-us" target="_blank" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:bold;color:#0056b3;text-decoration:none;border-radius:50px;border:2px solid #ffffff;">Get Started Today</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="background:#f8f9fa;padding:40px;border-top:1px solid #eeeeee;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="padding-bottom:25px;">
<a href="https://www.facebook.com/kyptronixllp/" target="_blank" style="margin:0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/145/145802.png" width="32" height="32"></a>
<a href="https://x.com/Kyptronixus" target="_blank" style="margin:0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/5969/5969020.png" width="32" height="32"></a>
<a href="https://www.linkedin.com/company/kyptronixllp/" target="_blank" style="margin:0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/145/145807.png" width="32" height="32"></a>
<a href="https://www.instagram.com/kyptronix_llp/" target="_blank" style="margin:0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/3955/3955024.png" width="32" height="32"></a>
<a href="https://www.youtube.com/@kyptronixllp2467" target="_blank" style="margin:0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" width="32" height="32"></a>
</td>
</tr>
<tr>
<td align="center" style="font-size:12px;color:#999999;line-height:1.6;">
<p style="margin:0 0 10px;"><strong>Kyptronix LLP</strong></p>
<p style="margin:0 0 20px;">Professional digital solutions and automation systems since 2015.<br>Trusted by professionals worldwide.</p>
<p style="margin:0;">
<a href="#" style="color:#bbbbbb;text-decoration:none;">Privacy Policy</a> &nbsp;|&nbsp;
<a href="#" style="color:#bbbbbb;text-decoration:none;">Terms of Service</a> &nbsp;|&nbsp;
<a href="#" style="color:#bbbbbb;text-decoration:none;">Unsubscribe</a>
</p>
<p style="margin-top:20px;font-size:11px;color:#cccccc;">© 2015–2026 Kyptronix LLP. All rights reserved.</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`
    },
    
    // Email 3 - What changed after we fixed the system
    {
        subject: "{{name}} — what changed after we fixed the system",
        body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Growth Example</title>
<style>
body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
body { margin: 0; padding: 0; width: 100% !important; background-color: #f4f7f6; font-family: Helvetica, Arial, sans-serif; }
@media screen and (max-width:600px){ .mobile-width{width:100%!important} .mobile-padding{padding:20px!important} }
</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;">
<tr>
<td align="center" style="padding:40px 10px;">
<table width="600" class="mobile-width" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,.05);overflow:hidden;">
<tr><td height="6" style="background:#0056b3"></td></tr>
<tr>
<td align="center" style="padding:40px 40px 25px;border-bottom:1px solid #eeeeee;">
<a href="https://kyptronix.us" target="_blank"><img src="https://media.designrush.com/agencies/325222/conversions/Kyptronix-logo-profile.jpg" width="180" alt="Kyptronix Logo" style="display:block;"></a>
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:25px;">
<tr>
<td align="center">
<a href="https://kyptronix.us/about-us" style="color:#555555;text-decoration:none;font-size:13px;font-weight:bold;padding:0 10px;text-transform:uppercase;letter-spacing:.5px;">About</a>
<span style="color:#e0e0e0;">|</span>
<a href="https://kyptronix.us/services" style="color:#555555;text-decoration:none;font-size:13px;font-weight:bold;padding:0 10px;text-transform:uppercase;letter-spacing:.5px;">Services</a>
<span style="color:#e0e0e0;">|</span>
<a href="https://kyptronix.us/package-and-pricing" style="color:#555555;text-decoration:none;font-size:13px;font-weight:bold;padding:0 10px;text-transform:uppercase;letter-spacing:.5px;">Packages</a>
<span style="color:#e0e0e0;">|</span>
<a href="https://kyptronix.us/portfolio" style="color:#555555;text-decoration:none;font-size:13px;font-weight:bold;padding:0 10px;text-transform:uppercase;letter-spacing:.5px;">Portfolio</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td class="mobile-padding" style="padding:40px 50px;color:#374151;font-size:16px;line-height:1.6;">
<h1 style="margin:0 0 20px;font-size:22px;color:#1F2937;">Hi {{name}},</h1>
<p>Recent example (kept vague on purpose):</p>
<p>A B2B team had traffic, ads, SDRs, tools — everything.<br>Still inconsistent revenue.</p>
<p>We didn't touch ads.<br>We didn't increase spend.</p>
<p>We fixed:</p>
<ul style="padding-left:18px;margin:0 0 20px;">
<li style="margin-bottom:5px;">Response time</li>
<li style="margin-bottom:5px;">Follow-up logic</li>
<li style="margin-bottom:5px;">Routing</li>
<li style="margin-bottom:5px;">Automation gaps</li>
</ul>
<p>14 days later:</p>
<p style="font-weight:bold; color:#0056b3; font-size:18px;">More booked calls than the previous 6 weeks combined.</p>
<p>Not magic.<br>Just removing friction.</p>
<p style="margin-bottom:30px;">Happy to show you how this looks on your side — free.</p>
<table cellpadding="0" cellspacing="0">
<tr>
<td style="background:#0056b3;border-radius:50px;">
<a href="https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ1kzqqp92tBVNRFyNSo_sdyCg68VzzRMbv947cCXtze9o3lML1qr7B-xhYMp8myDqwLR4vbhrr2" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-weight:bold;text-decoration:none;">Book Free System Check</a>
</td>
</tr>
</table>
<p style="margin-top:30px;">—<br><strong>Souvik Karmakar</strong><br>CEO, Kyptronix LLP</p>
<p style="font-size:14px;color:#4B5563;">+1 (302) 219-6889 (USA)<br>+91 91238 37577 (IND)<br><a href="https://kyptronix.us" style="color:#0056b3;text-decoration:none;">kyptronix.us</a></p>
<p style="font-size:13px;color:#6B7280;">651 N Broad St, Middletown, DE 19709, USA</p>
</td>
</tr>
<tr>
<td align="center" style="background-color:#2c3e50; background-image:linear-gradient(135deg,#2c3e50 0%,#0056b3 100%); padding:40px 30px;">
<h2 style="margin:0 0 15px;color:#ffffff;font-size:22px;">Ready to fix your growth system?</h2>
<p style="margin:0 0 25px;color:#e0e0e0;font-size:14px;line-height:1.5;max-width:420px;">Kyptronix LLP designs automation systems that capture, qualify, and convert leads — without manual chaos.</p>
<table cellpadding="0" cellspacing="0">
<tr>
<td style="background:#ffffff;border-radius:50px;">
<a href="https://kyptronix.us/contact-us" target="_blank" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:bold;color:#0056b3;text-decoration:none;border-radius:50px;border:2px solid #ffffff;">Get Started Today</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="background:#f8f9fa;padding:40px;border-top:1px solid #eeeeee;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="padding-bottom:25px;">
<a href="https://www.facebook.com/kyptronixllp/" target="_blank" style="margin:0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/145/145802.png" width="32" height="32"></a>
<a href="https://x.com/Kyptronixus" target="_blank" style="margin:0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/5969/5969020.png" width="32" height="32"></a>
<a href="https://www.linkedin.com/company/kyptronixllp/" target="_blank" style="margin:0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/145/145807.png" width="32" height="32"></a>
<a href="https://www.instagram.com/kyptronix_llp/" target="_blank" style="margin:0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/3955/3955024.png" width="32" height="32"></a>
<a href="https://www.youtube.com/@kyptronixllp2467" target="_blank" style="margin:0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" width="32" height="32"></a>
</td>
</tr>
<tr>
<td align="center" style="font-size:12px;color:#999999;line-height:1.6;">
<p style="margin:0 0 10px;"><strong>Kyptronix LLP</strong></p>
<p style="margin:0 0 20px;">Professional digital solutions and automation systems since 2015.<br>Trusted by professionals worldwide.</p>
<p style="margin:0;">
<a href="#" style="color:#bbbbbb;text-decoration:none;">Privacy Policy</a> &nbsp;|&nbsp;
<a href="#" style="color:#bbbbbb;text-decoration:none;">Terms of Service</a> &nbsp;|&nbsp;
<a href="#" style="color:#bbbbbb;text-decoration:none;">Unsubscribe</a>
</p>
<p style="margin-top:20px;font-size:11px;color:#cccccc;">© 2015–2026 Kyptronix LLP. All rights reserved.</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`
    },
    
    // Email 4 - System Audit offer
    {
        subject: "{{name}} — want me to look at your system?",
        body: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>System Audit</title>
<style>
body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
body { margin: 0; padding: 0; width: 100% !important; background-color: #f4f7f6; font-family: Helvetica, Arial, sans-serif; }
@media screen and (max-width:600px){ .mobile-width{width:100%!important} .mobile-padding{padding:20px!important} }
</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f6;">
<tr>
<td align="center" style="padding:40px 10px;">
<table width="600" class="mobile-width" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;box-shadow:0 4px 15px rgba(0,0,0,.05);overflow:hidden;">
<tr><td height="6" style="background:#0056b3"></td></tr>
<tr>
<td align="center" style="padding:40px 40px 25px;border-bottom:1px solid #eeeeee;">
<a href="https://kyptronix.us" target="_blank"><img src="https://media.designrush.com/agencies/325222/conversions/Kyptronix-logo-profile.jpg" width="180" alt="Kyptronix Logo" style="display:block;"></a>
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top:25px;">
<tr>
<td align="center">
<a href="https://kyptronix.us/about-us" style="color:#555555;text-decoration:none;font-size:13px;font-weight:bold;padding:0 10px;text-transform:uppercase;letter-spacing:.5px;">About</a>
<span style="color:#e0e0e0;">|</span>
<a href="https://kyptronix.us/services" style="color:#555555;text-decoration:none;font-size:13px;font-weight:bold;padding:0 10px;text-transform:uppercase;letter-spacing:.5px;">Services</a>
<span style="color:#e0e0e0;">|</span>
<a href="https://kyptronix.us/package-and-pricing" style="color:#555555;text-decoration:none;font-size:13px;font-weight:bold;padding:0 10px;text-transform:uppercase;letter-spacing:.5px;">Packages</a>
<span style="color:#e0e0e0;">|</span>
<a href="https://kyptronix.us/portfolio" style="color:#555555;text-decoration:none;font-size:13px;font-weight:bold;padding:0 10px;text-transform:uppercase;letter-spacing:.5px;">Portfolio</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td class="mobile-padding" style="padding:40px 50px;color:#374151;font-size:16px;line-height:1.6;">
<h1 style="margin:0 0 20px;font-size:22px;color:#1F2937;">Hi {{name}},</h1>
<p>At this point you know how I think.</p>
<p>If you want:</p>
<ul style="padding-left:18px;margin:0 0 20px;">
<li style="margin-bottom:8px;">Clear diagnosis</li>
<li style="margin-bottom:8px;">No sales pressure</li>
<li style="margin-bottom:8px;">Straight answers</li>
</ul>
<table cellpadding="0" cellspacing="0" style="margin: 25px 0;">
<tr>
<td style="background:#0056b3;border-radius:50px;">
<a href="https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ1kzqqp92tBVNRFyNSo_sdyCg68VzzRMbv947cCXtze9o3lML1qr7B-xhYMp8myDqwLR4vbhrr2" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-weight:bold;text-decoration:none;">Book Free 20-Min System Audit</a>
</td>
</tr>
</table>
<p>I'll tell you what's broken, what's fine, and what to ignore.<br>That's it.</p>
<p style="margin-top:30px;">—<br><strong>Souvik Karmakar</strong><br>CEO, Kyptronix LLP</p>
<p style="font-size:14px;color:#4B5563;">+1 (302) 219-6889 (USA)<br>+91 91238 37577 (IND)<br><a href="https://kyptronix.us" style="color:#0056b3;text-decoration:none;">kyptronix.us</a></p>
<p style="font-size:13px;color:#6B7280;">651 N Broad St, Middletown, DE 19709, USA</p>
</td>
</tr>
<tr>
<td align="center" style="background-color:#2c3e50; background-image:linear-gradient(135deg,#2c3e50 0%,#0056b3 100%); padding:40px 30px;">
<h2 style="margin:0 0 15px;color:#ffffff;font-size:22px;">Ready to fix your growth system?</h2>
<p style="margin:0 0 25px;color:#e0e0e0;font-size:14px;line-height:1.5;max-width:420px;">Kyptronix LLP designs automation systems that capture, qualify, and convert leads — without manual chaos.</p>
<table cellpadding="0" cellspacing="0">
<tr>
<td style="background:#ffffff;border-radius:50px;">
<a href="https://kyptronix.us/contact-us" target="_blank" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:bold;color:#0056b3;text-decoration:none;border-radius:50px;border:2px solid #ffffff;">Get Started Today</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="background:#f8f9fa;padding:40px;border-top:1px solid #eeeeee;">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td align="center" style="padding-bottom:25px;">
<a href="https://www.facebook.com/kyptronixllp/" target="_blank" style="margin:0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/145/145802.png" width="32" height="32"></a>
<a href="https://x.com/Kyptronixus" target="_blank" style="margin:0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/5969/5969020.png" width="32" height="32"></a>
<a href="https://www.linkedin.com/company/kyptronixllp/" target="_blank" style="margin:0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/145/145807.png" width="32" height="32"></a>
<a href="https://www.instagram.com/kyptronix_llp/" target="_blank" style="margin:0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/3955/3955024.png" width="32" height="32"></a>
<a href="https://www.youtube.com/@kyptronixllp2467" target="_blank" style="margin:0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" width="32" height="32"></a>
</td>
</tr>
<tr>
<td align="center" style="font-size:12px;color:#999999;line-height:1.6;">
<p style="margin:0 0 10px;"><strong>Kyptronix LLP</strong></p>
<p style="margin:0 0 20px;">Professional digital solutions and automation systems since 2015.<br>Trusted by professionals worldwide.</p>
<p style="margin:0;">
<a href="#" style="color:#bbbbbb;text-decoration:none;">Privacy Policy</a> &nbsp;|&nbsp;
<a href="#" style="color:#bbbbbb;text-decoration:none;">Terms of Service</a> &nbsp;|&nbsp;
<a href="#" style="color:#bbbbbb;text-decoration:none;">Unsubscribe</a>
</p>
<p style="margin-top:20px;font-size:11px;color:#cccccc;">© 2015–2026 Kyptronix LLP. All rights reserved.</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`
    }
];

/**
 * Send a single email using AWS SES
 */
const sendEmail = async ({ to, name, subject, body }) => {
    const sesClient = createSESClient();
    
    // Replace placeholders in subject and body
    const personalizedSubject = subject.replace(/\{\{name\}\}/gi, name || 'Hey');
    const personalizedBody = body.replace(/\{\{name\}\}/gi, name || 'there');
    
    const params = {
        Source: process.env.EMAIL_FROM || process.env.AWS_SES_FROM_EMAIL,
        Destination: {
            ToAddresses: [to],
        },
        Message: {
            Subject: {
                Data: personalizedSubject,
                Charset: 'UTF-8',
            },
            Body: {
                Html: {
                    Data: personalizedBody,
                    Charset: 'UTF-8',
                },
            },
        },
    };
    
    try {
        const command = new SendEmailCommand(params);
        const response = await sesClient.send(command);
        console.log(`Email sent to ${to}, MessageId: ${response.MessageId}`);
        return { success: true, messageId: response.MessageId, email: to };
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error.message);
        return { success: false, error: error.message, email: to };
    }
};

/**
 * Send bulk emails with delay between each
 */
const sendBulkEmails = async (contacts, subject, body, delayMs = 100) => {
    const results = [];
    
    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        
        if (!contact.email || !contact.email.includes('@')) {
            results.push({ 
                success: false, 
                error: 'Invalid email', 
                email: contact.email,
                name: contact.name 
            });
            continue;
        }
        
        const result = await sendEmail({
            to: contact.email,
            name: contact.name,
            subject,
            body
        });
        
        results.push({ ...result, name: contact.name });
        
        // Add delay between emails to respect SES rate limits
        if (i < contacts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    return results;
};

/**
 * Send email sequence with SMS and VAPI call follow-ups
 * Flow: Email 1 → 10s → SMS 1 → 30s → VAPI Call 1 → 2min → Email 2 → ... repeat
 */
const sendEmailSequence = async (contacts, initialSubject, initialBody, delayMinutes = 2) => {
    const allResults = {
        email1: [],
        sms1: [],
        call1: [],
        email2: [],
        sms2: [],
        call2: [],
        email3: [],
        sms3: [],
        call3: [],
        email4: [],
        sms4: [],
        call4: []
    };
    
    const emailDelayMs = delayMinutes * 60 * 1000; // 2 minutes between emails
    const smsDelayMs = 10 * 1000; // 10 seconds after each email
    const vapiDelayMs = 30 * 1000; // 30 seconds after each SMS
    
    // Set initial pending counts (4 emails + 4 SMS + 4 Calls per contact)
    setPending(contacts.length * 4, contacts.length * 4, contacts.length * 4);
    
    console.log(`Starting email+SMS+VAPI sequence for ${contacts.length} contacts...`);
    
    // Helper to count results
    const countResults = (results) => ({
        sent: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
    });
    
    // ========== Email 1: User's custom template ==========
    console.log('Sending Email 1 (Initial)...');
    allResults.email1 = await sendBulkEmails(contacts, initialSubject, initialBody);
    const e1 = countResults(allResults.email1);
    addEmailStats(e1.sent, e1.failed);
    setPending(contacts.length * 3, contacts.length * 4, contacts.length * 4); // 3 emails left
    console.log(`Email 1 complete: ${e1.sent} sent, ${e1.failed} failed`);
    
    // Wait 10 seconds then send SMS 1
    console.log('Waiting 10 seconds before SMS 1...');
    await new Promise(resolve => setTimeout(resolve, smsDelayMs));
    
    console.log('Sending SMS 1...');
    allResults.sms1 = await sendBulkSMS(contacts, 0); // Template index 0
    const s1 = countResults(allResults.sms1);
    addSmsStats(s1.sent, s1.failed);
    setPending(contacts.length * 3, contacts.length * 3, contacts.length * 4); // 3 SMS left
    console.log(`SMS 1 complete: ${s1.sent} sent, ${s1.failed} failed`);
    
    // Wait 30 seconds then make VAPI calls
    console.log('Waiting 30 seconds before VAPI Call 1...');
    await new Promise(resolve => setTimeout(resolve, vapiDelayMs));
    
    console.log('Making VAPI Call 1...');
    allResults.call1 = await makeBulkVapiCalls(contacts);
    const c1 = countResults(allResults.call1);
    addCallStats(c1.sent, c1.failed);
    setPending(contacts.length * 3, contacts.length * 3, contacts.length * 3); // 3 Calls left
    console.log(`VAPI Call 1 complete: ${c1.sent} initiated, ${c1.failed} failed`);
    
    // Wait 2 minutes before Email 2
    console.log(`Waiting ${delayMinutes} minutes before Email 2...`);
    await new Promise(resolve => setTimeout(resolve, emailDelayMs));
    
    // ========== Email 2: One mistake that kills B2B growth ==========
    console.log('Sending Email 2...');
    const template2 = EMAIL_TEMPLATES[1];
    allResults.email2 = await sendBulkEmails(contacts, template2.subject, template2.body);
    const e2 = countResults(allResults.email2);
    addEmailStats(e2.sent, e2.failed);
    setPending(contacts.length * 2, contacts.length * 3, contacts.length * 3); // 2 emails left
    console.log(`Email 2 complete: ${e2.sent} sent, ${e2.failed} failed`);
    
    // Wait 10 seconds then send SMS 2
    console.log('Waiting 10 seconds before SMS 2...');
    await new Promise(resolve => setTimeout(resolve, smsDelayMs));
    
    console.log('Sending SMS 2...');
    allResults.sms2 = await sendBulkSMS(contacts, 1); // Template index 1
    const s2 = countResults(allResults.sms2);
    addSmsStats(s2.sent, s2.failed);
    setPending(contacts.length * 2, contacts.length * 2, contacts.length * 3); // 2 SMS left
    console.log(`SMS 2 complete: ${s2.sent} sent, ${s2.failed} failed`);
    
    // Wait 30 seconds then make VAPI calls
    console.log('Waiting 30 seconds before VAPI Call 2...');
    await new Promise(resolve => setTimeout(resolve, vapiDelayMs));
    
    console.log('Making VAPI Call 2...');
    allResults.call2 = await makeBulkVapiCalls(contacts);
    const c2 = countResults(allResults.call2);
    addCallStats(c2.sent, c2.failed);
    setPending(contacts.length * 2, contacts.length * 2, contacts.length * 2); // 2 Calls left
    console.log(`VAPI Call 2 complete: ${c2.sent} initiated, ${c2.failed} failed`);
    
    // Wait 2 minutes before Email 3
    console.log(`Waiting ${delayMinutes} minutes before Email 3...`);
    await new Promise(resolve => setTimeout(resolve, emailDelayMs));
    
    // ========== Email 3: What changed after we fixed the system ==========
    console.log('Sending Email 3...');
    const template3 = EMAIL_TEMPLATES[2];
    allResults.email3 = await sendBulkEmails(contacts, template3.subject, template3.body);
    const e3 = countResults(allResults.email3);
    addEmailStats(e3.sent, e3.failed);
    setPending(contacts.length * 1, contacts.length * 2, contacts.length * 2); // 1 email left
    console.log(`Email 3 complete: ${e3.sent} sent, ${e3.failed} failed`);
    
    // Wait 10 seconds then send SMS 3
    console.log('Waiting 10 seconds before SMS 3...');
    await new Promise(resolve => setTimeout(resolve, smsDelayMs));
    
    console.log('Sending SMS 3...');
    allResults.sms3 = await sendBulkSMS(contacts, 2); // Template index 2
    const s3 = countResults(allResults.sms3);
    addSmsStats(s3.sent, s3.failed);
    setPending(contacts.length * 1, contacts.length * 1, contacts.length * 2); // 1 SMS left
    console.log(`SMS 3 complete: ${s3.sent} sent, ${s3.failed} failed`);
    
    // Wait 30 seconds then make VAPI calls
    console.log('Waiting 30 seconds before VAPI Call 3...');
    await new Promise(resolve => setTimeout(resolve, vapiDelayMs));
    
    console.log('Making VAPI Call 3...');
    allResults.call3 = await makeBulkVapiCalls(contacts);
    const c3 = countResults(allResults.call3);
    addCallStats(c3.sent, c3.failed);
    setPending(contacts.length * 1, contacts.length * 1, contacts.length * 1); // 1 Call left
    console.log(`VAPI Call 3 complete: ${c3.sent} initiated, ${c3.failed} failed`);
    
    // Wait 2 minutes before Email 4
    console.log(`Waiting ${delayMinutes} minutes before Email 4...`);
    await new Promise(resolve => setTimeout(resolve, emailDelayMs));
    
    // ========== Email 4: System Audit offer ==========
    console.log('Sending Email 4...');
    const template4 = EMAIL_TEMPLATES[3];
    allResults.email4 = await sendBulkEmails(contacts, template4.subject, template4.body);
    const e4 = countResults(allResults.email4);
    addEmailStats(e4.sent, e4.failed);
    setPending(0, contacts.length * 1, contacts.length * 1); // 0 emails left
    console.log(`Email 4 complete: ${e4.sent} sent, ${e4.failed} failed`);
    
    // Wait 10 seconds then send SMS 4
    console.log('Waiting 10 seconds before SMS 4...');
    await new Promise(resolve => setTimeout(resolve, smsDelayMs));
    
    console.log('Sending SMS 4...');
    allResults.sms4 = await sendBulkSMS(contacts, 3); // Template index 3
    const s4 = countResults(allResults.sms4);
    addSmsStats(s4.sent, s4.failed);
    setPending(0, 0, contacts.length * 1); // All done except calls
    console.log(`SMS 4 complete: ${s4.sent} sent, ${s4.failed} failed`);
    
    // Wait 30 seconds then make VAPI calls
    console.log('Waiting 30 seconds before VAPI Call 4...');
    await new Promise(resolve => setTimeout(resolve, vapiDelayMs));
    
    console.log('Making VAPI Call 4...');
    allResults.call4 = await makeBulkVapiCalls(contacts);
    const c4 = countResults(allResults.call4);
    addCallStats(c4.sent, c4.failed);
    setPending(0, 0, 0); // All done
    console.log(`VAPI Call 4 complete: ${c4.sent} initiated, ${c4.failed} failed`);
    
    console.log('Email+SMS+VAPI sequence complete!');
    
    return allResults;
};

module.exports = {
    sendEmail,
    sendBulkEmails,
    sendEmailSequence,
    EMAIL_TEMPLATES
};
