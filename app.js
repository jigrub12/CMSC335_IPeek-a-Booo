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

        // const abusedIP = await fetch('https://api.abuseipdb.com/api/v2/check?ipAddress=${ipAddress}', {
        //     headers:{
        //         'Key': process.env.ABUSEIPDB_API_KEY,
        //         'Accept': 'application/json'
        //     }
        // });
        // const abusedIPDATA = await abusedIP.json();
        // const threats = abusedIPDATA.data;


        const searchHistory = { ipAddress, geolocation, threats, searchDate: new Date() };
        await client.db(dbPlusCollection.db).collection(dbPlusCollection.collection).insertOne(searchHistory);

        const resultTable = generateResultTable(geolocation, threats);      
        res.render('afterSearch', { table: resultTable });
    } catch (error) {
        console.error("Ip Address error bruh", error);
        res.render('afterSearch', { table: '<p class="error">Failed to fetch data. Please try again.</p>' });
    } finally {
        await client.close();
    }
});

function generateResultTable(geolocation, threats) {
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
            </tbody>
        </table>
    `;
}


app.listen(portNum, () => {
    console.log(`Server running on port ${portNum}`);
});
