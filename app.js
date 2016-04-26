var uuid = require('node-uuid'),
    request = require('request'),
    express = require('express'),
    app = express(),
    multer = require('multer'),
    restler = require('restler'),
    upload = multer({dest:'./uploads/'}),
    bodyParser = require('body-parser'),
    Promise = require('bluebird'),
    shapeJS = require(__dirname + '/ShapeJSApi.js'),
    Utilities = require(__dirname + '/Utilities.js'),
    config = require(__dirname + '/config.json'),
    Shapeways = require(__dirname + '/ShapewaysApi.js'),
    OAuth = require('oauth').OAuth,
    prompt = require('prompt'),
    querystring = require('querystring');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function(req, res) {
    res.send('hello world');
});

app.post('/image', upload.single('shapeJS_img'), function(req, res) {
    var jobID = String(uuid.v1());
    var retryAttempts = 0;

    var image = restler.file('./uploads/' + req.file.filename, null, req.file.size);
    var baseFileName = "./3dFiles/" + req.file.filename;
    var files = Utilities.createFiles(req, baseFileName);

    getAndSendModels();

    function getAndSendModels() {
        shapeJS.updateScene(image, jobID, files)
        .then(shapeJS.getPreviewImage)
        .then(shapeJS.get3DModel)
        .then(Utilities.runPythonFixer)
        .then(Utilities.runFbxConv)
        .then(Utilities.zipModels)
        .then(sendModels)
        .then(Utilities.cleanUp)
        .catch(function(err) {
            console.error(err);
            res.status(500).send("Servers too crazy atm. Try again later.\n");
            res.end();
        });
    }

    function sendModels(files) {
        return new Promise(function(resolve, reject) {
            res.sendFile(files.zipFile, {root: __dirname}, function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log('Sent: ' + files.zipFile);
                    res.end();
                    resolve(files);
                }
            });
        });
    };
});

var client = new OAuth(
    Shapeways.OAuth1 + "/request_token/v1",
    Shapeways.OAuth1 + "/access_token/v1",
    config.app.key,
    config.app.secret,
    '1.0A',
    null,
    'HMAC-SHA1'
);

app.get('/authorize', function(req, res) {
    client.getOAuthRequestToken(function(error, token, secret, results) {
        this.oauthToken = token; // not in results meaning it wasn't given in the response???
        this.oauthSecret = secret;
        console.dir(results);
        console.log(results.authentication_url);
        // Since the token wasn't in the response, I have to set it myself.
        this.oauthToken = querystring.parse(results.authentication_url.split("?", 2)[1]).oauth_token;
        console.log('token: ', oauthToken);
        prompt.start();
        prompt.get('verifier', function(err, input) {
            if (err) console.error(err);
            client.getOAuthAccessToken(this.oauthToken, this.oauthSecret, input.verifier,
                function(error, token, secret, results) {
                    if (error) {
                        console.error(error);
                    }
                    this.oauthToken = token;
                    this.oauthSecret = secret;
                    console.log(token);
                    console.log(secret);
                    console.dir(results);
                }
            );
        });
    });
});

//test
app.get('/cart', function(req, res) {
    client.get(Shapeways.Cart, config.app.oauth_token, config.app.oauth_secret, function(err, data, response) {
        if (err) {console.error(err);}
        res.send(data);
    });
});

app.listen(process.env.PORT, function() {
    console.log('Listening on Port ' + process.env.PORT);
});

