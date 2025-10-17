const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Settings = require('./models/Settings');
const Search = require('./models/Search');
const Lead = require('./models/Lead');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lagacy-agent';
    await mongoose.connect(mongoURI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const seedDatabase = async () => {
  try {
    console.log('Seeding database with test data...');

    // Clear existing data
    await Settings.deleteMany({});
    await Search.deleteMany({});
    await Lead.deleteMany({});
    console.log('Cleared existing data');

    // Create default settings
    const settings = await Settings.create({
      apiKeys: {
        whoisxml: '',
        hunter: '',
        googlePlaces: ''
      },
      notifications: {
        email: false,
        slack: false
      },
      exportSettings: {
        autoExport: false,
        emailRecipients: ''
      }
    });
    console.log('Created default settings');

    // Create sample searches
    const search1 = await Search.create({
      query: 'example.com',
      searchType: 'domain',
      filters: {
        industry: 'Technology'
      },
      resultsCount: 3,
      status: 'completed',
      apiUsed: 'whoisxml',
      executedAt: new Date('2024-01-15')
    });

    const search2 = await Search.create({
      query: 'john@company.com',
      searchType: 'email',
      resultsCount: 2,
      status: 'completed',
      apiUsed: 'hunter',
      executedAt: new Date('2024-01-16')
    });

    const search3 = await Search.create({
      query: 'Tech Companies in San Francisco',
      searchType: 'location',
      filters: {
        location: 'San Francisco, CA',
        industry: 'Software'
      },
      resultsCount: 5,
      status: 'completed',
      apiUsed: 'google',
      executedAt: new Date('2024-01-17')
    });

    console.log('Created sample searches');

    // Create sample leads for search1
    await Lead.create([
      {
        name: 'John Smith',
        email: 'john.smith@example.com',
        phone: '+1-555-0101',
        company: 'Example Corp',
        website: 'https://example.com',
        address: '123 Business St',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        zipCode: '10001',
        industry: 'Technology',
        source: 'whoisxml',
        status: 'new',
        notes: 'Found via domain search',
        searchId: search1._id
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@example.com',
        phone: '+1-555-0102',
        company: 'Example Corp',
        website: 'https://example.com',
        address: '123 Business St',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        zipCode: '10001',
        industry: 'Technology',
        source: 'whoisxml',
        status: 'contacted',
        notes: 'Marketing Director',
        searchId: search1._id
      },
      {
        name: 'Michael Brown',
        email: 'michael.brown@example.com',
        phone: '+1-555-0103',
        company: 'Example Corp',
        website: 'https://example.com',
        address: '123 Business St',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        zipCode: '10001',
        industry: 'Technology',
        source: 'whoisxml',
        status: 'qualified',
        notes: 'CTO - Very interested',
        searchId: search1._id
      }
    ]);

    // Create sample leads for search2
    await Lead.create([
      {
        name: 'Emily Davis',
        email: 'emily.davis@company.com',
        phone: '+1-555-0201',
        company: 'Tech Solutions Inc',
        website: 'https://techsolutions.com',
        city: 'Boston',
        state: 'MA',
        country: 'USA',
        industry: 'Software',
        source: 'hunter',
        status: 'new',
        notes: 'CEO of Tech Solutions',
        searchId: search2._id
      },
      {
        name: 'Robert Wilson',
        email: 'robert.wilson@company.com',
        phone: '+1-555-0202',
        company: 'Tech Solutions Inc',
        website: 'https://techsolutions.com',
        city: 'Boston',
        state: 'MA',
        country: 'USA',
        industry: 'Software',
        source: 'hunter',
        status: 'contacted',
        notes: 'VP of Sales',
        searchId: search2._id
      }
    ]);

    // Create sample leads for search3
    await Lead.create([
      {
        name: 'Lisa Anderson',
        email: 'lisa@startupxyz.com',
        phone: '+1-555-0301',
        company: 'Startup XYZ',
        website: 'https://startupxyz.com',
        address: '456 Innovation Drive',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        zipCode: '94102',
        industry: 'Software',
        source: 'google',
        status: 'new',
        searchId: search3._id
      },
      {
        name: 'David Martinez',
        email: 'david@cloudtech.io',
        phone: '+1-555-0302',
        company: 'CloudTech Solutions',
        website: 'https://cloudtech.io',
        address: '789 Tech Boulevard',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        zipCode: '94103',
        industry: 'Cloud Computing',
        source: 'google',
        status: 'contacted',
        searchId: search3._id
      },
      {
        name: 'Jennifer Lee',
        email: 'jennifer@aicompany.com',
        phone: '+1-555-0303',
        company: 'AI Innovations',
        website: 'https://aicompany.com',
        address: '321 AI Street',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        zipCode: '94104',
        industry: 'Artificial Intelligence',
        source: 'google',
        status: 'qualified',
        notes: 'Very promising lead',
        searchId: search3._id
      },
      {
        name: 'Thomas Garcia',
        email: 'thomas@dataanalytics.com',
        phone: '+1-555-0304',
        company: 'Data Analytics Pro',
        website: 'https://dataanalytics.com',
        address: '654 Data Lane',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        zipCode: '94105',
        industry: 'Data Science',
        source: 'google',
        status: 'new',
        searchId: search3._id
      },
      {
        name: 'Amanda Taylor',
        email: 'amanda@cybersec.com',
        phone: '+1-555-0305',
        company: 'CyberSec Solutions',
        website: 'https://cybersec.com',
        address: '987 Security Blvd',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        zipCode: '94106',
        industry: 'Cybersecurity',
        source: 'google',
        status: 'closed',
        notes: 'Deal closed successfully',
        searchId: search3._id
      }
    ]);

    console.log('Created sample leads');
    console.log('\n=== Database Seeded Successfully ===');
    console.log('Settings: 1 document');
    console.log('Searches: 3 documents');
    console.log('Leads: 10 documents');
    console.log('====================================\n');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the seed function
connectDB().then(() => {
  seedDatabase();
});
