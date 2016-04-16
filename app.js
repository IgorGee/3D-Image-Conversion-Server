var restler = require('restler');
var uuid = require('node-uuid');
var fs = require('fs');
var request = require('request');
var async = require('async');
var express = require('express');
var app = express();
var multer = require('multer');
var upload = multer({dest:'./uploads/'});
var bodyParser = require('body-parser');
var exec = require('child_process').exec;
var Constants = require(__dirname + '/Constants.js')

var braintree = require("braintree");
var gateway = braintree.connect({
    environment: braintree.Environment.Sandbox,
    merchantId: "2b663n6dzs7dcykd",
    publicKey: "zqhqpx9pwm2ksnt8",
    privateKey: "df68d33d893c85ed24eea55aa76c7924"
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/client_token', function(req, res){
    gateway.clientToken.generate({}, function(err, response) {
        console.log(err);
        res.send(response.clientToken);
        console.log("Just gave client a token");
    });
});

app.post('/checkout', function(req, res){
    var nonce = req.body.payment_method_nonce;
    console.log(nonce);
    console.log("Someone just paid us....");
    gateway.transaction.sale({
        amount: '42.42',
        paymentMethodNonce: nonce,
        options: {
            submitForSettlement: true
        }
    }, function(err, result) {
        if (!err) {
            console.log("We just made bank");
        }
    });
});

app.get('/', function(req, res) {
    res.send('hello world');
});

app.post('/image', upload.single('shapeJS_img'), function(req, res) {
    var uuidJS = uuid.v4();
    var retryAttempts = 0;
    var previewImageFilePath = "./3dFiles/" + req.file.filename + ".jpg";
    var stlFilePath = "./3dFiles/" + req.file.filename + ".stl";
    var fbxFilePath = "./3dFiles/" + req.file.filename + ".fbx";
    var g3dbFilePath = "./3dFiles/" + req.file.filename + ".g3db";
    var zipFilePath = "./3dFiles/" + req.file.filename + ".zip";

    console.log("Request File: ");
    console.log(req.file)

    tryAgain();

    function tryAgain() {
        var options = {
            multipart: true,
            headers: {},
            data: {
                shapeJS_img: restler.file('./uploads/' + req.file.filename, null, req.file.size),
                jobID: uuidJS,
                script: Constants.JS_2D_TO_3D
            }
        }

        restler.post(Constants.UPDATE_SCENE_ENDPOINT, options).on('complete', function(response) {
            console.log();
            console.log(response);
            console.log();
            // console.log(error);
            // console.log(body);

            try {
                fs.accessSync(previewImageFilePath, fs.F_OK);
                get3DModel();
            } catch (e) {
                getPreviewImage();
            }
        });
    }

    function getPreviewImage() {
        restler.get(Constants.MAKE_IMAGE_CACHED_ENDPOINT + uuidJS, {decoding: 'buffer'})
        .on('complete', function(response) {
            if (!(response instanceof Object) && response.indexOf("<title>Error 410 Job not cached</title>") > -1) {
                console.log("410 Error, Retrying now...")
                if (retryAttempts < 10) {
                    tryAgain();
                    retryAttempts++;
                    return;
                } else {
                    console.log("Servers too crazy atm, try again later.");
                    res.status(500).end();
                }
            } else {
                fs.writeFile(previewImageFilePath, response, function(err) {
                    if (err) {
                        return console.log(err);
                    }
                });
                get3DModel();
            }
        });
    }

    function get3DModel() {
        restler.get(Constants.SAVE_MODEL_CACHED_ENDPOINT + uuidJS, {decoding: 'buffer'})
        .on('complete', function(response) {
            if (!(response instanceof Object) && response.indexOf("<title>Error 410 Job not cached</title>") > -1) {
                console.log("410 Error, Retrying now...")
                if (retryAttempts < 10) {
                    tryAgain();
                    retryAttempts++;
                    return;
                } else {
                    console.log("Servers too crazy atm, try again later.");
                    res.status(500).end();
                }
            } else {
                fs.writeFile(stlFilePath, response, function(err) {
                    if (err) {
                        return console.log(err);
                    }
                    runPythonFixer();
                });
            }
        });
    }

    // execute python script for importing, decimating, and exporting
    function runPythonFixer() {
        exec('sudo blender -b -P 3dFiles/import_decimate_export.py -- ' + stlFilePath, callback);

        function callback(error, stdout, stderr) {
            console.log('Running python script');
                console.log(error);
                console.log(stdout);
                console.log(stderr);
            if (error) {
                console.log(error);
                console.log(stdout);
                console.log(stderr);
            } else {
                console.log("Success\n");
            }

            runFbxConv();
        }
    }

    // execute fbx-conv
    function runFbxConv() {
        exec('../conversion-tools/fbx-conv/fbx-conv-lin64 ' + fbxFilePath + ' ' + g3dbFilePath, callback);

        function callback(error, stdout, stderr) {
            console.log('Running fbx-conv');
            if (error) {
                console.log(error);
                console.log(stderr);
            } else {
                console.log("Success\n");
            }
            zipModels();
        }
    }

    function zipModels() {
        exec('zip -j ' + zipFilePath + ' ' + stlFilePath + ' ' + g3dbFilePath + ' ' + previewImageFilePath, callback);

        function callback(error, stdout, stderr) {
            console.log('Zipping files...');
            console.log(stdout);
            if (error) {
                console.log(error);
                console.log(stderr);
            } else {
                console.log("Success\n");
            }
            sendModels();
        }
    }

    function sendModels() {
        res.sendFile(zipFilePath, {root: __dirname}, function(err) {
            if (err) {
                if (retryAttempts < 10) {
                    tryAgain();
                    retryAttempts++;
                    return;
                } else {
                    console.log(err);
                    res.status(err.status || 500).end();
                }
            } else {
                console.log('Sent: ' + zipFilePath);
                cleanUp();
            }
        });
    }

    function cleanUp() {
        console.log("Cleaning " + req.file.originalname);

        fs.unlink(req.file.path, function(err) {
            if (err) {
                console.log(err);
            }
        });
        console.log("Deleted source image");

        fs.unlink(stlFilePath, function(err) {
            if (err) {
                console.log(err);
            }
        });
        console.log("Deleted stlFile");

        fs.unlink(fbxFilePath, function(err) {
            if (err) {
                console.log(err);
            }
        });
        console.log("Deleted fbxFile");

        fs.unlink(g3dbFilePath, function(err) {
            if (err) {
                console.log(err);
            }
        });
        console.log("Deleted g3dbFile");

        fs.unlink(zipFilePath, function(err) {
            if (err) {
                console.log(err);
            }
        });
        console.log("Deleted zipFile");

        fs.unlink(previewImageFilePath, function(err) {
            if (err) {
                console.log(err);
            }
        });
        console.log("Deleted preview image");
    }

});

app.listen(process.env.PORT, function() {
    console.log('Listening on Port ' + process.env.PORT);
});

