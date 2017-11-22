'use strict';
/**
 * Created by bogdanmedvedev on 13.06.16.
 */
var fs = require('fs'),
    path = require('path'),
    nconf = require('nconf');

var error = require('../../app/modules/error/index');
var log = require('../../app/modules/log/index');

var statusSaveConfig = true;
function reloadConfig() {

    try {
        if (statusSaveConfig) {
            nconf.argv()
                .env()
                .file({file: _path_root + 'config.json'});


        }
    } catch (e) {
        setTimeout(reloadConfig, 5000);
        log.error('File config.json [format Error]:', e);
    }

}
reloadConfig();
var chokidar = require('chokidar');
var watcher = chokidar.watch(_path_root + 'config.json', {
    ignored: /[\/\\]\./,
    persistent: true
});
watcher
    .on('add', function () {
        if (model.get('server:server:logs:config')) log.info('[config watcher] .on("add")');
        reloadConfig();
    })
    .on('change', function () {
        if (model.get('server:server:logs:config')) log.info('[config watcher] .on("change")');
        reloadConfig();
    });

function saveConfig() {
    if (model.get('server:server:logs:config')) log.info('[config save] starting...');
    statusSaveConfig = false;
    nconf.save(function (err) {
        if (err) return new error('core/createConfig.js/nconf.save :' + err);
        if (model.get('server:server:logs:config')) log.info('[config save] saved and read new config starting...');

        fs.readFile(_path_root + 'config.json', function (err, data) {
            if (model.get('server:server:logs:config')) log.info('[config save] saved and JSON.parse new config starting...');
            if (err) return new error('core/createConfig.js/fs.readFile :' + err);
            try {
                let res = JSON.parse(data);
                if (model.get('server:server:logs:config')) log.info('[config save] saved and read new config to JSON');
                if (model.get('server:server:logs:config')) console.log('[config]', res);
                statusSaveConfig = true;
            } catch (e) {
                log.error('File config.json [Error read format]: see config.json saveConfig' + e);
            }
        });
    });
}

const model = {
    set: (param, value, testWrite, dontSave)=> {
        if (model.get('server:server:logs:config')) log.info('[config set] Param:' + param + ', Value:' + value + ', testParam:' + testWrite + ',dontSave:' + dontSave);
        if (testWrite) {
            if (!nconf.get(param)) {
                nconf.set(param, value);
                return true;
            }
            return false;
        }
        nconf.set(param, value);
        if (!dontSave) saveConfig();
        return true;
    },
    get: function (param) {
        var value = nconf.get(param);
        if (param != 'server:server:logs:config' && model.get('server:server:logs:config')) log.info('[config get] Param:' + param + ', Value:' + value);
        return value
    },
    save: saveConfig,
    rereadConfig: reloadConfig,
    getAllToJsonConfig: (callback)=> {
        if (err)callback(err, null);
        fs.readFile(_path_root + 'config.json', (err, data)=> {
            if (err)callback(err, null);
            try {
                callback(null, JSON.parse(data));
            } catch (e) {
                callback('File config.json [Error read format]: see config.json getAllToJsonConfig' + e, null);

            }
        });
    }
};
module.exports = model;
var config = require('./createConfig');
