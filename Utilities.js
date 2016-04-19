var Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    exec = require('child_process').exec,
    exports = module.exports,
    Command = require(__dirname + '/Command.js');

exports.createFiles = function(req, baseFileName) {
    var previewImageFilePath = baseFileName + ".jpg",
        stlFilePath = baseFileName + ".stl",
        fbxFilePath = baseFileName + ".fbx",
        g3dbFilePath = baseFileName + ".g3db",
        zipFilePath = baseFileName + ".zip";

    return {
        originalFile: req.file.path,
        stlFile: stlFilePath,
        fbxFile: fbxFilePath,
        g3dbFile: g3dbFilePath,
        zipFile: zipFilePath,
        previewFile: previewImageFilePath
    };
};

// execute python script for importing, decimating, and exporting
exports.runPythonFixer = function(files) {
    return new Promise(function(resolve, reject) {
        console.log('Running python script.');
        exec(Command.DECIMATE + files.stlFile, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
};

// execute fbx-conv
exports.runFbxConv = function(files) {
    return new Promise(function(resolve, reject) {
        console.log('Running fbx-conv.');
        exec(Command.FBX_CONVERSION + files.fbxFile + ' ' + files.g3dbFile, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(files);
            }
        });
    });
};

exports.zipModels = function(files) {
    return new Promise(function(resolve, reject) {
        console.log('Zipping files.');
        exec(Command.ZIP_FILES + files.zipFile + ' ' + files.stlFile + ' ' + files.g3dbFile + ' ' + files.previewFile, function() {
            resolve(files);
        });
    });
};

exports.cleanUp = function(files) {
    return new Promise(function(resolve, reject) {
        console.log("Cleaning up.");
        for (var file in files) {
            if (files.hasOwnProperty(file)) {
                fs.unlinkAsync(files[file]);
            }
        }
        console.log("Done.");
    });
};
