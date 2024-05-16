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

        const searchHistory = { ipAddress, geolocation,searchDate: new Date() };
        await client.db(dbPlusCollection.db).collection(dbPlusCollection.collection).insertOne(searchHistory);

        const resultTable = generateResultTable(geolocation);      
        res.render('afterSearch', { table: resultTable });
    } catch (error) {
        console.error("Ip Address error bruh", error);
        res.render('afterSearch', { table: '<p class="error">Failed to fetch data. Please try again.</p>' });
    } finally {
        await client.close();
    }
});

function generateResultTable(geolocation) {
    return `
        <table border="1" style="width:100%; text-align:left;">
            <thead>
                <tr>
                    <th>Geolocation Information</th>
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
            </tbody>
        </table>
    `;
}

app.listen(portNum, () => {
    console.log(`Server running on port ${portNum}`);
});
