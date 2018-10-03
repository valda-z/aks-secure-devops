// set up ======================================================================
var express = require('express');
var app = express(); // create our app w/ express
var port = process.env.PORT || 8080; // set the port
var mongoose = require('mongoose'); // mongoose for mongodb				
var database = require('./config/database'); // load the database config

var morgan = require('morgan'); // log requests to the console (express4)
var bodyParser = require('body-parser'); // pull information from HTML POST (express4)
var methodOverride = require('method-override'); // simulate DELETE and PUT (express4)

// configuration ===============================================================
try {
    console.log("Connecting to DB ...");
    mongoose.connect(database.url);
} catch (err) {
    console.log(err);
}

app.use(morgan('dev')); // log every request to the console
app.use(bodyParser.urlencoded({ 'extended': 'true' })); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
app.use(methodOverride());

var db = mongoose.connection;
db.on('error', function(err) {
    console.log('connection error:' + err);
    process.exit(1);
});
db.once('open', function() {
    console.log("Connected to DB");
});

// routes 
require('./app/routes.js')(app);

// start app
app.listen(port);
console.log("App listening on port " + port);