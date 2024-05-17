const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
const portNum = process.env.PORT || 3000;
const uri = process.env.MONGO_CONNECTION_STRING;
const dbPlusCollection = { db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION };

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.set('views', path.resolve(__dirname, 'views'));
app.set('view engine', 'ejs');

function getClientIP(req, res, next) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? forwarded.split(/, /)[0] : req.connection.remoteAddress;
    req.clientIP = (ip === '::1' || ip === '127.0.0.1') ? '8.8.8.8' : ip; // Using google's ip address as placeholder IP if localhost
    next();
}

app.use(getClientIP);

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.post('/search', async (req, res) => {
    const { ipAddress } = req.body;

    const client = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverApi: ServerApiVersion.v1
    });

    try {
        await client.connect();
        const geoResponse = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${process.env.IP_GEOLOCATION_API_KEY}&ip=${ipAddress}`);
        const geolocation = await geoResponse.json();

        const userIp = req.clientIP; // This will work if the app is behind a proxy that forwards the client's IP
        const userGeoResponse = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=${process.env.IP_GEOLOCATION_API_KEY}&ip=${userIp}`);
        const userGeolocation = await userGeoResponse.json();

        const userLat = parseFloat(userGeolocation.latitude);
        const userLon = parseFloat(userGeolocation.longitude);
        const targetLat = parseFloat(geolocation.latitude);
        const targetLon = parseFloat(geolocation.longitude);

        console.log(userLat, userLon, targetLat, targetLon);

        if (isNaN(userLat) || isNaN(userLon) || isNaN(targetLat) || isNaN(targetLon)) {
            throw new Error("Invalid geolocation data received.");
        }

        // Calculate the distance between the user's location and the searched IP location
        const distance = calcDistanceBetweenIPs(userLat, userLon, targetLat, targetLon);

        const searchHistory = { ipAddress, geolocation, distance, searchDate: new Date() };
        await client.db(dbPlusCollection.db).collection(dbPlusCollection.collection).insertOne(searchHistory);

        const resultTable = generateResultTable(geolocation, distance);      
        res.render('afterSearch', { table: resultTable });
    } catch (error) {
        console.error("Ip Address error bruh", error);
        res.render('afterSearch', { table: '<p class="error">Failed to fetch data. Please try again.</p>' });
    } finally {
        await client.close();
    }
});
// Function to calculate distance between two coordinates
function calcDistanceBetweenIPs(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function generateResultTable(geolocation, distance) {

    return `
        <table border="1" style="width:100%; text-align:center;">
            <thead>
                <tr>
                    <th colspan = "2">Geolocation Information</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>IP</td>
                    <td>${geolocation.ip}</td>
                </tr>
                <tr>
                    <td>Country</td>
                    <td>${geolocation.country_name} <img src="${geolocation.country_flag}" alt="Country Flag" style="width:20px;height:15px;"></td>
                </tr>
                <tr>
                    <td>City</td>
                    <td>${geolocation.city}</td>
                </tr>
                <tr>
                    <td>Latitude</td>
                    <td>${geolocation.latitude}</td>
                </tr>
                <tr>
                    <td>Longitude</td>
                    <td>${geolocation.longitude}</td>
                </tr>
                <tr>
                    <td>Distance of entered IP from Your Location:</td>
                    <td>${distance.toFixed(2)} km </td>
                </tr>
            </tbody>
        </table>
    `;
}


app.listen(portNum, () => {
    console.log(`Server running on port ${portNum}`);
});
