var restler = require('restler'),
    Promise = require('bluebird'),
    fs = Promise.promisifyAll(require('fs')),
    Constants = require(__dirname + '/Constants'),
    exports = module.exports;

exports.updateScene = function(image, jobID, files) {
    var options = {
            multipart: true,
            headers: {},
            data: {
                shapeJS_img: image,
                jobID: jobID,
                script: Constants.JS_2D_TO_3D
            }
        };

    return new Promise(function(resolve, reject) {
        console.log("jobID: " + options.data.jobID);
        var retryAttempts = 0;
        restler.post(Constants.UPDATE_SCENE_ENDPOINT, options)
        .on('success', function(data, response) {
            console.log("UpdateScene successful.");
            resolve({jobID:jobID, files:files});
        })
        .on('fail', function(data, response) {
            console.error("Update Scene Error " + response.statusCode);
            if (retryAttempts < 5) {
                retryAttempts++;
                console.log('Retrying Update...');
                this.retry(1);
            } else {
                reject(new Error("Update"));
            }
        });
    });
};

exports.getPreviewImage = function(obj) {
    return new Promise(function(resolve, reject) {
        var retryAttempts = 0;
        restler.get(Constants.MAKE_IMAGE_CACHED_ENDPOINT + obj.jobID, {decoding: 'buffer'})
        .on('success', function(data, response) {
            console.log("MakeImageCached successful.")
            fs.writeFileAsync(obj.files.previewFile, data).then(function() {
                resolve(obj);
            });
        })
        .on('fail', function(data, response) {
            console.error("Preview Image Error " + response.statusCode);
            if (retryAttempts < 5) {
                retryAttempts++;
                console.log('Retrying Preview...');
                this.retry(1);
            } else {
                reject(new Error("Preview"));
            }
        });
    });
};

exports.get3DModel = function(obj) {
    return new Promise(function(resolve, reject) {
        var retryAttempts = 0;
        restler.get(Constants.SAVE_MODEL_CACHED_ENDPOINT + obj.jobID, {decoding: 'buffer'})
        .on('success', function(data, response) {
            console.log("SaveModelCached successful.")
            fs.writeFileAsync(obj.files.stlFile, data).then(function() {
                resolve(obj.files);
            });
        })
        .on('fail', function(data, response) {
            console.error("Get Model Error " + response.statusCode);
            if (retryAttempts < 5) {
                retryAttempts++;
                console.log('Retrying Model...');
                this.retry(1);
            } else {
                reject(new Error("Model"));
            }
        });
    });
};