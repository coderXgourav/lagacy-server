const ExcelJS = require('exceljs');
const logger = require('../utils/logger');

async function exportToExcel(businesses) {
  try {
    logger.info(`Exporting ${businesses.length} businesses to Excel`);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Legacy Websites');

    // Define columns
    worksheet.columns = [
      { header: 'Business Name', key: 'businessName', width: 30 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Phone', key: 'phone', width: 20 },
      { header: 'Email(s)', key: 'emails', width: 40 },
      { header: 'Website', key: 'website', width: 40 },
      { header: 'Domain Creation Date', key: 'domainCreationDate', width: 25 },
      { header: 'Address', key: 'address', width: 50 },
      { header: 'Location', key: 'location', width: 30 }
    ];

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' }
    };

    // Add data rows
    businesses.forEach(business => {
      worksheet.addRow({
        businessName: business.businessName,
        category: business.category,
        phone: business.phone,
        emails: business.emails?.join(', ') || '',
        website: business.website,
        domainCreationDate: business.domainCreationDate,
        address: business.address,
        location: `${business.location?.city || ''}, ${business.location?.state || ''}, ${business.location?.country || ''}`
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    logger.success('Excel file generated successfully');
    return buffer;
  } catch (error) {
    logger.error('Failed to export to Excel', error.message);
    throw error;
  }
}

module.exports = { exportToExcel };
