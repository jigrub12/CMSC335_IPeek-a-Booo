const express = require('express');
const axios = require('axios');

const IP_GEOLOCATION_API_KEY = process.env.IP_GEOLOCATION_API_KEY;
const ABUSEIPDB_API_KEY = process.env.ABUSEIPDB_API_KEY;

module.exports = (db) => {
    const router = express.Router();

    router.get('/', (req, res) => {
        res.render('index');
    });

    router.post('/search', async (req, res) => {
        const { ipAddress } = req.body;

        try {
            // Fetch geolocation data
            const geoResponse = await axios.get(`https://api.ipgeolocation.io/ipgeo?apiKey=${IP_GEOLOCATION_API_KEY}&ip=${ipAddress}`);
            const geolocation = geoResponse.data;

            // Fetch threat data
            const threatResponse = await axios.get(`https://api.abuseipdb.com/api/v2/check?ipAddress=${ipAddress}`, {
                headers: {
                    'Key': ABUSEIPDB_API_KEY,
                    'Accept': 'application/json'
                }
            });
            const threats = threatResponse.data.data;

            // Save to database
            const searchHistory = { ipAddress, geolocation, threats, searchDate: new Date() };
            await db.collection(dbPlusCollection.collection).insertOne(searchHistory);

            // Generate HTML table
            const resultTable = generateResultTable(geolocation, threats);

            res.render('result', { table: resultTable });
        } catch (error) {
            console.error(error);
            res.render('result', { table: '<p class="error">Failed to fetch data. Please try again.</p>' });
        }
    });

    return router;
};

function generateResultTable(geolocation, threats) {
    let table = `
        <table border="1">
            <thead>
                <tr>
                    <th>Geolocation Information</th>
                    <th>Threat Information</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        <p>IP: ${geolocation.ip}</p>
                        <p>Country: ${geolocation.country_name}</p>
                        <p>City: ${geolocation.city}</p>
                        <p>Latitude: ${geolocation.latitude}</p>
                        <p>Longitude: ${geolocation.longitude}</p>
                    </td>
                    <td>
                        <p>IP Address: ${threats.ipAddress}</p>
                        <p>Is Public: ${threats.isPublic}</p>
                        <p>Confidence of Abuse: ${threats.abuseConfidenceScore}</p>
                        <p>ISP: ${threats.isp}</p>
                        <p>Domain: ${threats.domain}</p>
                        <p>Usage Type: ${threats.usageType}</p>
                        <p>Country Code: ${threats.countryCode}</p>
                    </td>
                </tr>
            </tbody>
        </table>
    `;
    return table;
}
