const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

// Create SNS client
const createSNSClient = () => {
    return new SNSClient({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    });
};

// SMS Templates for the sequence
const SMS_TEMPLATES = [
    // SMS 1 - After Email 1
    {
        message: `{{name}}, Souvik here.
I sent you an email about the 3 growth leaks we keep seeing in B2B.
Worth a look if growth feels inconsistent.`
    },
    // SMS 2 - After Email 2
    {
        message: `Quick thought — most B2B growth issues aren't lead issues, they're system issues.
Sent details by email.`
    },
    // SMS 3 - After Email 3
    {
        message: `Fixed a B2B team's follow-up system → more booked calls in 14 days than 6 weeks.
No ad spend increase.
Details in email.`
    },
    // SMS 4 - After Email 4
    {
        message: `If you want me to look at your system, book here: {{link}}
No pitch. Just clarity.`
    }
];

const BOOKING_LINK = 'https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ1kzqqp92tBVNRFyNSo_sdyCg68VzzRMbv947cCXtze9o3lML1qr7B-xhYMp8myDqwLR4vbhrr2';

// Country to phone code mapping
const COUNTRY_CODES = {
    // Common countries
    'INDIA': '91',
    'IN': '91',
    'IND': '91',
    'UNITED STATES': '1',
    'USA': '1',
    'US': '1',
    'UNITED KINGDOM': '44',
    'UK': '44',
    'GB': '44',
    'CANADA': '1',
    'CA': '1',
    'CAN': '1',
    'AUSTRALIA': '61',
    'AU': '61',
    'AUS': '61',
    'GERMANY': '49',
    'DE': '49',
    'DEU': '49',
    'FRANCE': '33',
    'FR': '33',
    'FRA': '33',
    'ITALY': '39',
    'IT': '39',
    'ITA': '39',
    'SPAIN': '34',
    'ES': '34',
    'ESP': '34',
    'BRAZIL': '55',
    'BR': '55',
    'BRA': '55',
    'MEXICO': '52',
    'MX': '52',
    'MEX': '52',
    'JAPAN': '81',
    'JP': '81',
    'JPN': '81',
    'CHINA': '86',
    'CN': '86',
    'CHN': '86',
    'SOUTH KOREA': '82',
    'KR': '82',
    'KOR': '82',
    'RUSSIA': '7',
    'RU': '7',
    'RUS': '7',
    'SINGAPORE': '65',
    'SG': '65',
    'SGP': '65',
    'NETHERLANDS': '31',
    'NL': '31',
    'NLD': '31',
    'BELGIUM': '32',
    'BE': '32',
    'BEL': '32',
    'SWITZERLAND': '41',
    'CH': '41',
    'CHE': '41',
    'SWEDEN': '46',
    'SE': '46',
    'SWE': '46',
    'NORWAY': '47',
    'NO': '47',
    'NOR': '47',
    'DENMARK': '45',
    'DK': '45',
    'DNK': '45',
    'IRELAND': '353',
    'IE': '353',
    'IRL': '353',
    'NEW ZEALAND': '64',
    'NZ': '64',
    'NZL': '64',
    'SOUTH AFRICA': '27',
    'ZA': '27',
    'ZAF': '27',
    'UAE': '971',
    'UNITED ARAB EMIRATES': '971',
    'AE': '971',
    'SAUDI ARABIA': '966',
    'SA': '966',
    'SAU': '966',
    'PHILIPPINES': '63',
    'PH': '63',
    'PHL': '63',
    'INDONESIA': '62',
    'ID': '62',
    'IDN': '62',
    'MALAYSIA': '60',
    'MY': '60',
    'MYS': '60',
    'THAILAND': '66',
    'TH': '66',
    'THA': '66',
    'VIETNAM': '84',
    'VN': '84',
    'VNM': '84',
    'PAKISTAN': '92',
    'PK': '92',
    'PAK': '92',
    'BANGLADESH': '880',
    'BD': '880',
    'BGD': '880',
    'ISRAEL': '972',
    'IL': '972',
    'ISR': '972',
    'TURKEY': '90',
    'TR': '90',
    'TUR': '90',
    'POLAND': '48',
    'PL': '48',
    'POL': '48',
    'ARGENTINA': '54',
    'AR': '54',
    'ARG': '54',
    'CHILE': '56',
    'CL': '56',
    'CHL': '56',
    'COLOMBIA': '57',
    'CO': '57',
    'COL': '57',
    'NIGERIA': '234',
    'NG': '234',
    'NGA': '234',
    'EGYPT': '20',
    'EG': '20',
    'EGY': '20',
    'KENYA': '254',
    'KE': '254',
    'KEN': '254',
};

/**
 * Get country code from country name
 */
const getCountryCode = (country) => {
    if (!country) return '1'; // Default to US
    const normalized = country.toString().trim().toUpperCase();
    return COUNTRY_CODES[normalized] || '1'; // Default to US if not found
};

/**
 * Format phone number for AWS SNS (must be E.164 format: +1234567890)
 * Uses country field from CSV to determine the correct country code
 */
const formatPhoneNumber = (phone, country) => {
    if (!phone) return null;
    
    // Remove all non-digit characters
    let cleaned = phone.toString().replace(/\D/g, '');
    
    // If already starts with country code (11+ digits), use as is
    if (cleaned.length > 10) {
        return '+' + cleaned;
    }
    
    // If starts with 0, remove it (common in local formats)
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.slice(1);
    }
    
    // Get country code based on country field
    const countryCode = getCountryCode(country);
    
    // Add country code
    cleaned = countryCode + cleaned;
    
    // Add + prefix
    return '+' + cleaned;
};

/**
 * Send a single SMS using AWS SNS
 */
const sendSMS = async ({ to, name, country, message, templateIndex }) => {
    const snsClient = createSNSClient();
    
    const formattedPhone = formatPhoneNumber(to, country);
    
    if (!formattedPhone || formattedPhone.length < 10) {
        console.log(`Invalid phone number for ${name}: ${to}`);
        return { success: false, error: 'Invalid phone number', phone: to, name };
    }
    
    // Personalize the message
    let personalizedMessage = message
        .replace(/\{\{name\}\}/gi, name || 'there')
        .replace(/\{\{link\}\}/gi, BOOKING_LINK);
    
    const params = {
        PhoneNumber: formattedPhone,
        Message: personalizedMessage,
        MessageAttributes: {
            'AWS.SNS.SMS.SenderID': {
                DataType: 'String',
                StringValue: 'Kyptronix'
            },
            'AWS.SNS.SMS.SMSType': {
                DataType: 'String',
                StringValue: 'Transactional'
            }
        }
    };
    
    try {
        const command = new PublishCommand(params);
        const response = await snsClient.send(command);
        console.log(`SMS sent to ${formattedPhone} (${name}, ${country}), MessageId: ${response.MessageId}`);
        return { success: true, messageId: response.MessageId, phone: formattedPhone, name };
    } catch (error) {
        console.error(`Failed to send SMS to ${formattedPhone}:`, error.message);
        return { success: false, error: error.message, phone: formattedPhone, name };
    }
};

/**
 * Send bulk SMS to all contacts
 */
const sendBulkSMS = async (contacts, templateIndex, delayMs = 100) => {
    const results = [];
    const template = SMS_TEMPLATES[templateIndex];
    
    if (!template) {
        console.error(`Invalid SMS template index: ${templateIndex}`);
        return results;
    }
    
    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        
        // Skip if no phone number
        if (!contact.number) {
            results.push({ 
                success: false, 
                error: 'No phone number', 
                phone: null,
                name: contact.name 
            });
            continue;
        }
        
        const result = await sendSMS({
            to: contact.number,
            name: contact.name,
            country: contact.country, // Pass country to SMS function
            message: template.message,
            templateIndex
        });
        
        results.push(result);
        
        // Add delay between SMS to respect rate limits
        if (i < contacts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    return results;
};

module.exports = {
    sendSMS,
    sendBulkSMS,
    SMS_TEMPLATES,
    BOOKING_LINK,
    formatPhoneNumber,
    getCountryCode,
    COUNTRY_CODES
};
