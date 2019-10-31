'use strict';

const Config = require("config-watch");

const configObj = {
    config: undefined,
    initialized: false,
    init(cb) {
      if (this.initialized) {return};

      this.initialized = true;
      console.log('Config init...')
      this.config = new Config("config.json", {
         defaults: {
         mqtt_ip: '192.168.2.27',
         mqtt_topic: 'leaf/charging',
         debug: false,
         test_date: '',
         test_all_on: false,
       }
      },(err, config) => {
       if (err) {
         console.error('There was an error reading the config file!', err);
         return;
       }
       console.log("Config loadet:\n"+this, config.get());
      });

      this.config.on("change", (err, config) => {
          if (err) {
            console.error('There was an error reading the config file!', err);
            return;
          }
          console.log("Config changed. The new config is:\n", config.get());
       });
    },

    get(key) {
      try {
        return this.config.get(key);
      } catch (err) {
       // This will not catch the throw!
         console.error('Config noch nicht geladen!');
      };
    },
};

module.exports = configObj;
