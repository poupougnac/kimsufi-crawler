(function () {
  'use strict';

  var req = require('request'),
          mout = require('mout'),
          config = require('config'),
          handlebars = require('handlebars'),
          later = require('later'),
          moment = require('moment'),
          fs = require('fs'),
//          cronJob = require('cron').CronJob,
          util = require('util');

  var requiredServers = ['KS-2', 'KS-3', 'KS-4'],
          serverTypes = config.get('server-types'),
          datacenters = config.get('datacenters');

  var ovhStatus = 'https://ws.ovh.com/dedicated/r2/ws.dispatcher/getAvailability2';

  var source = ''
          + '\nCurrently some servers of your'
          + ' required category are available.\n\n'
          + ' Details are as follows:\n\n'
          + '{{#servers}}{{> availableServers}}{{/servers}}';
  handlebars.registerPartial('availableServers', ''
          + 'Server Name: {{server}}({{code}})\n'
          + 'Available Zones:\n'
          + '{{#zones}}{{> zones}}{{/zones}}');
  handlebars.registerPartial('zones', ''
          + '{{zone_full_name}} ({{availability}})\n');
  handlebars.registerHelper('zone_full_name', function () {
    return datacenters[this.zone];
  });
  var template = handlebars.compile(source);

  function checkStatus() {
    req.get(ovhStatus, function (err, httpResponse, body) {
      if (err !== null) {
        return;
      }
      var requiredServerAvailability = [],
              response = JSON.parse(body),
              availability = response.answer.availability;

      mout.array.forEach(requiredServers, function (val) {
        var currentServerAvailableIndex = mout.array.findIndex(availability, {reference: serverTypes[val]});
        if (currentServerAvailableIndex > -1) {
          var serverAvailibility = availability[currentServerAvailableIndex];
          var metaZones = mout.array.filter(serverAvailibility.metaZones, function (val, key, arr) {
            return (val.availability !== 'unknown');
          });
          var zones = mout.array.filter(serverAvailibility.zones, function (val, key, arr) {
            return (val.availability !== 'unknown');
          });
          if (zones.length > 0) {
            requiredServerAvailability.push({
              server: val,
              code: serverTypes[val],
              zones: zones,
              metaZones: metaZones
            });
          }
        }
      });

      var emailContent = '\nCurrently there are no servers available as per your requirement.';
      if (requiredServerAvailability.length > 0) {
        emailContent = template({servers: requiredServerAvailability});
      }
      emailContent = ''
              + moment().format('MMMM Do YYYY, h:mm:ss a')
              + emailContent + '\n\n';
      fs.appendFile('response.txt', emailContent, function (err) {
        if (err !== null) {
          console.log('Couldn\'t write to file');
        }
      });
    });
  }

  //var job = new CronJob('* 2 * * * *', checkStatus, null, true, 'America/Los_Angeles');

  var count = 4, sched = later.parse.text('every 2 mins');
  var timer = later.setInterval(function () {
    checkStatus();
    if (--count < 0) {
      timer.clear();
    }
  }, sched);
})();