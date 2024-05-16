const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
require('dotenv').config({path: path.resolve(__dirname, '.env')});
const {MongoClient, ServerApiVersion} = require('mongodb');

const portNum = process.env.PORT||3000;

const uri = process.env.MONGO_CONNECTION_STRING;
const dbPlusCollection = { db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION}

let db;
MongoClient.connect(uri, {
    useNewURLParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1
}, (err,client) => {
    if(err) throw err;
    db = client.db(dbPlusCollection.db);
    console.log("Connection done to db")
})

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.set('views', path.resolve(__dirname, 'views'));
app.set('view engine', 'ejs');

const routers = require('./routes/index')(db);
app.use('/', routers);

app.listen(portNum, () => {
    console.log('Server running');
})
