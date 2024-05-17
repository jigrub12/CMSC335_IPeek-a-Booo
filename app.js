const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');

const app = express();
const portNum = process.env.PORT;
const uri = process.env.MONGO_CONNECTION_STRING;
const dbPlusCollection = { db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION };

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const viewsPath = path.resolve(__dirname, 'Views');
app.set('views', viewsPath);
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


//this is my post functionality where I fetch the ip geolocation api to get more information on the IP Address that the user entered.
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

        // this is what I call to calculate the distance between the user's location and the searched IP location
        const distance = calcDistanceBetweenIPs(userLat, userLon, targetLat, targetLon);

        //creating a search history object to update into the database
        const searchHistory = { ipAddress, geolocation, distance, searchDate: new Date() };
        await client.db(dbPlusCollection.db).collection(dbPlusCollection.collection).insertOne(searchHistory);

        //here we call the the table generating method using the geolocation object and distance
        const resultTable = generateResultTable(geolocation, distance);      
        res.render('afterSearch', { table: resultTable });

    } catch (error) {
        console.error("Ip Address error bruh", error);
        res.render('afterSearch', { table: '<p class="error">Failed to fetch data. Please try again.</p>' });
    } finally {
        await client.close();
    }
});

// Function to calculate distance between two coordinates, this is what we'll use to calculate the distance between the current user on the website
//and the ip address mentioned.
//However, note by Jigar: if you host the website locally, it will default to google's IP Address your IP address, since the distance functionality
//is only for once the website renders.
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


//get call to the search history page. fetches previously searched ips from the db and shows.
app.get('/history', async (req, res) => {
    const client = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverApi: ServerApiVersion.v1
    });
    try {
        await client.connect();
        const history = await client.db(dbPlusCollection.db).collection(dbPlusCollection.collection).find({}).toArray();
        const resultTable = generateHistoryTable(history);//calling the search history generating table function here.
        res.render('history', { table: resultTable });
    } catch (error) {
        console.error("Error fetching history", error);
        res.render('history', { table: '<p class="error">Failed to fetch search history.</p>' });
    }
});

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
                    <td>${geolocation.country_name} 
                    <img src="${geolocation.country_flag}" alt="Country Flag" style="width:20px;height:15px;"></td>
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

function generateHistoryTable(history) {
    return `
        <table border="1" style="width:100%; text-align:center;">
            <thead>
                <tr>
                    <th>IP Address</th>
                    <th>Country</th>
                    <th>City</th>
                    <th>Latitude</th>
                    <th>Longitude</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>
                ${history.map(item => `
                    <tr>
                        <td>${item.ipAddress}</td>
                        <td>${item.geolocation.country_name}</td>
                        <td>${item.geolocation.city}</td>
                        <td>${item.geolocation.latitude}</td>
                        <td>${item.geolocation.longitude}</td>
                        <td>${new Date(item.searchDate).toISOString().split('T')[0]}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}


//this is our get call to the top searched ip addresses from the db/site. this fetches the db and filters out info to depict the occurence of top
//10 searched IPs.
app.get('/top-searched-ips', async (req, res) => {
    const client = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverApi: ServerApiVersion.v1
    });

    try {
        await client.connect();
        const locationCollection = client.db(dbPlusCollection.db).collection(dbPlusCollection.collection);

        const topSearched = await locationCollection.aggregate([
            { $group: { _id: "$ipAddress", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]).toArray();

        res.render('top-searched-ips', { topSearched });
    } catch (error) {
        console.error("Error fetching top searched IP addresses", error);
        res.status(500).send('Failed to fetch top searched IP addresses');
    } finally {
        await client.close();
    }
});


app.listen(portNum, () => {
    console.log(`Server running on port ${portNum}`);
});
