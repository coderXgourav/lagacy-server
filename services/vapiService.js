/**
 * VAPI AI Phone Call Service
 * Integrates with VAPI API to make AI-powered phone calls
 */

const VAPI_API_URL = 'https://api.vapi.ai/call/phone';
const VAPI_API_KEY = process.env.VAPI_API_KEY || '984598a5-b74d-4c4d-9b03-9737fc113ef7';
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID || 'a01b626c-215e-4275-8bbf-bab267d5e229';
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID || '2f7bce3c-45fc-4260-ba60-40c971497503';
const { registerCall } = require('./statsService');

/**
 * Format phone number for VAPI
 * Ensures the number starts with + and only contains digits
 */
const formatPhoneForVapi = (phone, country) => {
    if (!phone) return null;
    
    // Remove all non-digit characters
    let cleaned = phone.toString().replace(/[^0-9]/g, '');
    
    // Remove any decimal portion (like .0)
    cleaned = cleaned.replace(/\.\d+$/, '');
    
    // If already has country code (more than 10 digits), use as is
    if (cleaned.length > 10) {
        return '+' + cleaned.slice(0, 15); // VAPI max is 15 digits
    }
    
    // Country code mapping
    const COUNTRY_CODES = {
        'INDIA': '91',
        'IN': '91',
        'USA': '1',
        'US': '1',
        'UNITED STATES': '1',
        'UK': '44',
        'UNITED KINGDOM': '44',
        'GB': '44',
        'CANADA': '1',
        'CA': '1',
        'AUSTRALIA': '61',
        'AU': '61',
        'GERMANY': '49',
        'DE': '49',
        'FRANCE': '33',
        'FR': '33',
    };
    
    // Get country code
    const countryUpper = (country || '').toUpperCase().trim();
    const countryCode = COUNTRY_CODES[countryUpper] || '1'; // Default to US
    
    // Remove leading zero if present
    if (cleaned.startsWith('0')) {
        cleaned = cleaned.slice(1);
    }
    
    return '+' + countryCode + cleaned;
};

/**
 * Make a single VAPI AI phone call
 */
const makeVapiCall = async ({ phoneNumber, firstName, country }) => {
    const formattedPhone = formatPhoneForVapi(phoneNumber, country);
    
    if (!formattedPhone) {
        return { 
            success: false, 
            error: 'Invalid phone number',
            phoneNumber 
        };
    }
    
    const payload = {
        phoneNumberId: VAPI_PHONE_NUMBER_ID,
        assistantId: VAPI_ASSISTANT_ID,
        customer: {
            number: formattedPhone
        },
        assistantOverrides: {
            variableValues: {
                firstName: firstName || 'there'
            }
        }
    };
    
    try {
        const response = await fetch(VAPI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${VAPI_API_KEY}`
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log(`VAPI call initiated to ${formattedPhone} (${firstName}), CallId: ${data.id || 'N/A'}`);
            
            // Register call for tracking
            if (data.id) {
                registerCall(data.id, formattedPhone, firstName);
            }

            return { 
                success: true, 
                callId: data.id,
                phoneNumber: formattedPhone,
                name: firstName
            };
        } else {
            console.error(`VAPI call failed for ${formattedPhone}:`, data);
            return { 
                success: false, 
                error: data.message || data.error || 'Unknown error',
                phoneNumber: formattedPhone,
                name: firstName
            };
        }
    } catch (error) {
        console.error(`VAPI call error for ${formattedPhone}:`, error.message);
        return { 
            success: false, 
            error: error.message,
            phoneNumber: formattedPhone,
            name: firstName
        };
    }
};

/**
 * Make bulk VAPI calls with delay between each
 */
const makeBulkVapiCalls = async (contacts, delayMs = 2000) => {
    const results = [];
    
    console.log(`Starting VAPI calls to ${contacts.length} contacts...`);
    
    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        
        if (!contact.number) {
            results.push({
                success: false,
                error: 'No phone number',
                name: contact.name
            });
            continue;
        }
        
        const result = await makeVapiCall({
            phoneNumber: contact.number,
            firstName: contact.name || 'there',
            country: contact.country
        });
        
        results.push(result);
        
        // Add delay between calls (VAPI recommends 2 seconds)
        if (i < contacts.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    
    const successCount = results.filter(r => r.success).length;
    console.log(`VAPI calls complete: ${successCount}/${contacts.length} initiated`);
    
    return results;
};

module.exports = {
    makeVapiCall,
    makeBulkVapiCalls,
    formatPhoneForVapi
};
