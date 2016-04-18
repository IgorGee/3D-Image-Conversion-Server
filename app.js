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
var Constants = require(__dirname + '/Constants.js');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

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
    console.log(req.file);

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
        };

        restler.post(Constants.UPDATE_SCENE_ENDPOINT, options)
            .on('complete', function(response) {
                console.log(response);

                // Check to see if the image file exists.
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
                    console.log("410 Error, Retrying now...");
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
                    console.log("410 Error, Retrying now...");
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
        exec('sudo blender -b -P 3dFiles/import_decimate_export.py -- ' + stlFilePath, function(error, stdout, stderr) {
            console.log('Running python script');
            if (error !== null) {
                console.log("Success\n");
            } else {
                console.log("Error\n");
                console.log("stdout: " + stdout);
                console.log("stderr: " + stderr);
            }
            runFbxConv();
        });
    }

    // execute fbx-conv
    function runFbxConv() {
        exec('../conversion-tools/fbx-conv/fbx-conv-lin64 ' + fbxFilePath + ' ' + g3dbFilePath, function (error, stdout, stderr) {
            console.log('Running fbx-conv');
            if (error !== null) {
                console.log("Success\n");
            } else {
                console.log("stdout: " + stdout);
                console.log("stderr: " + stderr);
            }
            zipModels();
        });
    }

    function zipModels() {
        exec('zip -j ' + zipFilePath + ' ' + stlFilePath + ' ' + g3dbFilePath + ' ' + previewImageFilePath, function (error, stdout, stderr) {
            console.log('Zipping files...');
            console.log(stdout);
            if (error !== null) {
                console.log("Success\n");
            } else {
                console.log("stdout: " + stdout);
                console.log("stderr: " + stderr);
            }
            sendModels();
        });
    }

    function sendModels() {
        res.sendFile(zipFilePath, {root: __dirname}, function(err) {
            if (err) {
                if (retryAttempts < 10) {
                    tryAgain();
                    retryAttempts++;
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
        var files = [req.file.path, stlFilePath, fbxFilePath, g3dbFilePath, zipFilePath, previewImageFilePath];
        for (var i = 0, len = files.length; i < len; i++) {
            deleteFile(files[i]);
        }
    }

    function deleteFile(file) {
        fs.unlink(file, function(err) {
            if (err !== null) {
                console.log("Deleted " + String(file));
            } else {
                console.log("Something wrong happened when trying to delete " +
                    String(file) + ": " + err);
            }
        });
    }
});

app.listen(process.env.PORT, function() {
    console.log('Listening on Port ' + process.env.PORT);
});

