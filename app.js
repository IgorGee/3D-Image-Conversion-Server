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
    Utilities = require(__dirname + '/Utilities.js');

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

app.listen(process.env.PORT, function() {
    console.log('Listening on Port ' + process.env.PORT);
});

