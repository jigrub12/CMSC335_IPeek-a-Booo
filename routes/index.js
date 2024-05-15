const express = require('express');
const axios = require('axios');

const IP_GEOLOCATION_API_KEY = process.env.IP_GEOLOCATION_API_KEY;
const ABUSEIPDB_API_KEY = process.env.ABUSEIPDB_API_KEY;

module.exports = (db) => {
    const router = express.Router();

    router.get('/', (req, res) => {
        res.render('pages/index');
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

            res.render('pages/result', { geolocation, threats });
        } catch (error) {
            console.error(error);
            res.render('pages/result', { error: 'Failed to fetch data. Please try again.' });
        }
    });

    return router;
};
