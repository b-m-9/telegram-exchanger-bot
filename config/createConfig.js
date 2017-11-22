/**
 * Created by bogdanmedvedev on 13.06.16.
 */

'use strict';
var config = require('./index');
var os = require('os');
var random = require('../../app/modules/random/index');

var portfinder = require('portfinder');

config.set('refresh_interval', 5000, true, true);
config.set('tg_token', '', true, true);


config.save();