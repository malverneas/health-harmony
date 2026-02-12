/**
 * Utility to export JSON data as a CSV file.
 * CSV format is natively supported by Excel.
 */
export const downloadAsCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;

    // 1. Get headers from the first object
    const headers = Object.keys(data[0]);

    // 2. Map data rows
    const csvRows = data.map(row => {
        return headers.map(header => {
            let value = row[header];

            // Handle null/undefined
            if (value === null || value === undefined) value = '';

            // Handle objects/arrays (e.g. medications list)
            if (typeof value === 'object') {
                value = JSON.stringify(value);
            }

            // Escape double quotes and wrap in quotes to handle commas
            const escapedValue = ('' + value).replace(/"/g, '""');
            return `"${escapedValue}"`;
        }).join(',');
    });

    // 3. Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...csvRows
    ].join('\n');

    // 4. Create blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};
