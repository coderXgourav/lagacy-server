const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Headers defined by the user
const FILE_HEADERS = [
  'domain_name', 'query_time', 'create_date', 'update_date', 'expiry_date',
  'domain_registrar_id', 'domain_registrar_name', 'domain_registrar_whois', 'domain_registrar_url',
  'registrant_name', 'registrant_company', 'registrant_address', 'registrant_city',
  'registrant_state', 'registrant_zip', 'registrant_country', 'registrant_email',
  'registrant_phone', 'column_19', 'column_20', 'column_21', 'column_22',
  'column_23', 'column_24', 'column_25', 'column_26', 'column_27', 'column_28',
  'column_29', 'column_30', 'column_31', 'column_32', 'column_33', 'column_34',
  'column_35', 'column_36', 'column_37', 'column_38', 'column_39', 'column_40',
  'column_41', 'column_42', 'column_43', 'column_44', 'column_45', 'column_46', 'column_47'
];

const REQUIRED_COLUMNS = [
  'registrant_name',
  'domain_name',
  'registrant_phone',
  'registrant_email',
  'create_date',
  'update_date',
  'expiry_date',
  'domain_registrar_name',
  'registrant_address',
  'registrant_country'
];

exports.uploadCsv = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const countries = new Set();

    // Use explicit headers to handle files without headers or with messy first lines
    const stream = fs.createReadStream(filePath)
      .pipe(csv({
        separator: '\t',
        headers: FILE_HEADERS,
        skipLines: 0 // We'll handle header row manually if it exists
      }))
      .on('data', (row) => {
        // Check if this is the header row
        if (row.registrant_country === 'registrant_country') return;

        if (row.registrant_country) {
          const country = row.registrant_country.trim();
          // Filter out garbage or empty strings
          if (country && country.length > 1) {
            countries.add(country);
          }
        }
      })
      .on('end', () => {
        const countryList = Array.from(countries).sort().filter(Boolean);
        res.json({
          success: true,
          fileId: req.file.filename,
          countries: countryList,
          message: `Processed ${countryList.length} unique countries`
        });
      })
      .on('error', (err) => {
        console.error('CSV Parsing Error:', err);
        res.status(500).json({ success: false, message: 'Error parsing CSV' });
      });

  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, message: 'Server error during upload' });
  }
};

exports.filterCsv = (req, res) => {
  const { fileId, country, page = 1, limit = 10 } = req.body;

  if (!fileId || !country) {
    return res.status(400).json({ success: false, message: 'Missing fileId or country' });
  }

  const filePath = path.join(__dirname, '../uploads', fileId);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found. Please re-upload.' });
  }

  const results = [];
  let skipCount = (page - 1) * limit;
  let hasMore = false;

  const stream = fs.createReadStream(filePath)
    .pipe(csv({
      separator: '\t',
      headers: FILE_HEADERS
    }))
    .on('data', (row) => {
      // Ignore header row
      if (row.registrant_country === 'registrant_country') return;

      if (row.registrant_country && row.registrant_country.trim() === country) {
        if (skipCount > 0) {
          skipCount--;
        } else if (results.length < limit) {
          // Filter columns
          const filteredRow = {};
          REQUIRED_COLUMNS.forEach(col => {
            filteredRow[col] = row[col] || '';
          });
          results.push(filteredRow);
        } else {
          hasMore = true;
          stream.destroy();
        }
      }
    })
    .on('end', () => {
      res.json({
        success: true,
        data: results,
        hasMore,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    })
    .on('close', () => {
      if (!res.headersSent) {
        res.json({
          success: true,
          data: results,
          hasMore,
          page: parseInt(page),
          limit: parseInt(limit)
        });
      }
    })
    .on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, message: 'Error processing file' });
      }
    });
};

exports.downloadResult = (req, res) => {
  const { fileId, country } = req.query; // GET request for download usually

  if (!fileId || !country) {
    return res.status(400).send('Missing fileId or country');
  }

  const filePath = path.join(__dirname, '../uploads', fileId);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="filtered_${country}_${Date.now()}.csv"`);

  // Write Header
  res.write(REQUIRED_COLUMNS.join(',') + '\n');

  fs.createReadStream(filePath)
    .pipe(csv({
      separator: '\t',
      headers: FILE_HEADERS
    }))
    .on('data', (row) => {
      // Ignore header row
      if (row.registrant_country === 'registrant_country') return;

      if (row.registrant_country && row.registrant_country.trim() === country) {
        const line = REQUIRED_COLUMNS.map(col => {
          let val = row[col] || '';
          // Escape CSV injection or quotes
          if (val.includes(',') || val.includes('"') || val.includes('\n')) {
            val = `"${val.replace(/"/g, '""')}"`;
          }
          return val;
        }).join(',');
        res.write(line + '\n');
      }
    })
    .on('end', () => {
      res.end();
    })
    .on('error', (err) => {
      console.error('Download Error:', err);
      res.end();
    });
};
