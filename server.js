//  OpenShift sample Node application
var express = require('express'),
    app     = express(),
    morgan  = require('morgan'),
    request = require('request'),
    btoa = require('btoa');
    
Object.assign=require('object-assign')

app.engine('html', require('ejs').renderFile);
app.use(morgan('combined'))

var port = process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080,
    ip   = process.env.IP   || process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0',
    mongoURL = process.env.OPENSHIFT_MONGODB_DB_URL || process.env.MONGO_URL,
    mongoURLLabel = "";

if (mongoURL == null) {
  var mongoHost, mongoPort, mongoDatabase, mongoPassword, mongoUser;
  // If using plane old env vars via service discovery
  if (process.env.DATABASE_SERVICE_NAME) {
    var mongoServiceName = process.env.DATABASE_SERVICE_NAME.toUpperCase();
    mongoHost = process.env[mongoServiceName + '_SERVICE_HOST'];
    mongoPort = process.env[mongoServiceName + '_SERVICE_PORT'];
    mongoDatabase = process.env[mongoServiceName + '_DATABASE'];
    mongoPassword = process.env[mongoServiceName + '_PASSWORD'];
    mongoUser = process.env[mongoServiceName + '_USER'];

  // If using env vars from secret from service binding  
  } else if (process.env.database_name) {
    mongoDatabase = process.env.database_name;
    mongoPassword = process.env.password;
    mongoUser = process.env.username;
    var mongoUriParts = process.env.uri && process.env.uri.split("//");
    if (mongoUriParts.length == 2) {
      mongoUriParts = mongoUriParts[1].split(":");
      if (mongoUriParts && mongoUriParts.length == 2) {
        mongoHost = mongoUriParts[0];
        mongoPort = mongoUriParts[1];
      }
    }
  }

  if (mongoHost && mongoPort && mongoDatabase) {
    mongoURLLabel = mongoURL = 'mongodb://';
    if (mongoUser && mongoPassword) {
      mongoURL += mongoUser + ':' + mongoPassword + '@';
    }
    // Provide UI label that excludes user id and pw
    mongoURLLabel += mongoHost + ':' + mongoPort + '/' + mongoDatabase;
    mongoURL += mongoHost + ':' +  mongoPort + '/' + mongoDatabase;
  }
}
var db = null,
    dbDetails = new Object();

var initDb = function(callback) {
  if (mongoURL == null) return;

  var mongodb = require('mongodb');
  if (mongodb == null) return;

  mongodb.connect(mongoURL, function(err, conn) {
    if (err) {
      callback(err);
      return;
    }

    db = conn;
    dbDetails.databaseName = db.databaseName;
    dbDetails.url = mongoURLLabel;
    dbDetails.type = 'MongoDB';

    console.log('Connected to MongoDB at: %s', mongoURL);
  });
};

app.get('/', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    var col = db.collection('counts');
    // Create a document with request IP and current time of request
    col.insert({ip: req.ip, date: Date.now()});
    col.count(function(err, count){
      if (err) {
        console.log('Error running count. Message:\n'+err);
      }
      res.render('index.html', { pageCountMessage : count, dbInfo: dbDetails });
    });
  } else {
    res.render('index.html', { pageCountMessage : null});
  }
});


function captionImage(imageData) {
    return new Promise((resolve, reject) => {

    var boundary = 'xxxxxxxxxxxxxxxxxxxxxx';
    var data = "--" + boundary + "\r\n";
    data += imageData;
    var payload = Buffer.from(data, "utf8");
    
var requestSettings = {
    method: 'POST',
    //url: 'http://httpbin.org/post',
    url: 'http://max-image-caption-generator.max.us-south.containers.appdomain.cloud/model/predict',
    headers: {'User-Agent': 'node/1.0', 'Accept': "application/json"},
    //formData: {image: imageData}
    //formData: {image: {value:imageData, options: {filename: "abcd.jpg"}}}
    formData: {image: {value:imageData, options: {filename: "abcd.jpg", contentType: 'image/jpeg'}}}
    // BADformData: {image: {value:imageData}}
};
        request(requestSettings, (error, response, body) => {
            if (error) reject(error);
            if (response.statusCode != 200) {
                reject('Invalid status code <' + response.statusCode + '>');
            }
            resolve(body);
        });
    });
}

function downloadImage(url) {
    return new Promise((resolve, reject) => {
var requestSettings = {
    method: 'GET',
    url: url,
    encoding: null
};
        request(requestSettings, (error, response, body) => {
            if (error) reject(error);
            if (response.statusCode != 200) {
                reject('Invalid status code <' + response.statusCode + '>');
            }
            console.log("DDD_DOWNLOAD_GOT");
            console.log(typeof(body));
            resolve(body);
        });
    });
}

async function demoPage(req, res) {
    console.log("DDD_DEMOPAGE_S");
    try {
        var imageDataBinary = await downloadImage('https://picsum.photos/200/300')
        //var imageDataBinary = await downloadImage('https://picsum.photos/id/218/200/300')
        var b64encoded = btoa(String.fromCharCode.apply(null, imageDataBinary));
        var imageData = "data:image/jpeg;base64," + b64encoded;

        console.log("DDD_DEMOPAGE_GET");
        console.log(typeof(imageData));
        var captions = await captionImage(imageDataBinary);
        console.log("DDD_CAPTION_GOT_WAITE");
        console.log(captions)
        res.render('demo.html', {'imageData': imageData, 'captionData':captions });
        console.log("DDD_DEMOPAGE_E");
    } catch (error) {
        console.error('ERROR:');
        console.error(error);
    }
}


app.get('/demo', function (req, res) {
    console.log("DDD_DEMO_S");
    demoPage(req, res);
    console.log("DDD_DEMO_E");
});

app.get('/pagecount', function (req, res) {
  // try to initialize the db on every request if it's not already
  // initialized.
  if (!db) {
    initDb(function(err){});
  }
  if (db) {
    db.collection('counts').count(function(err, count ){
      res.send('{ pageCount: ' + count + '}');
    });
  } else {
    res.send('{ pageCount: -1 }');
  }
});

// error handling
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500).send('Something bad happened!');
});

initDb(function(err){
  console.log('Error connecting to Mongo. Message:\n'+err);
});

app.listen(port, ip);
console.log('Server running on http://%s:%s', ip, port);

module.exports = app ;
