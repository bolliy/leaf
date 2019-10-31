// controller.js
'use strict'

const mqtt = require('mqtt');
const config = require('./config');
config.init();
//console.log(config.get("mqtt_ip"));
const client = mqtt.connect('mqtt://'+config.get("mqtt_ip"));
var _topic = config.get("mqtt_topic");

const mqttRouter = {
    schalter : undefined,
    connected : false,
    init(schalter,eventHandler) {
      this.schalter = schalter;
      this.eventHandler = eventHandler;

      client.on('connect', () => {
        console.log('mqtt connected');
        this.connected = true;
        client.subscribe(_topic+'/tele/LWT');  /* Online/offline */
        client.subscribe(_topic+'/stat/POWER'); /* ON/OFF */
      });

      client.on('disconnect', () => {
        console.log('mqtt disconnected');
        this.connected = false;
      });

      client.on('message', (topic, message) => {
         console.log('Event mqtt message '+message);
         if (topic.indexOf(_topic) === 0) {
           switch (topic) {
              case _topic+'/tele/LWT':
                return this.handleConnected(message)
              case _topic+'/stat/POWER':
                return this.handleState(message)
           }
         }
         console.log('No handler for topic %s', topic)
     });
  },

  handleConnected (message) {
    console.log(_topic+' switch connected status %s ', message)
    let connected = (message.toString() === 'online');
    this.schalter.connected = connected;
  },

  handleState (message) {
    this.schalter.state = message.toString();
    console.log(_topic+' switch state update to %s', message);
    this.eventHandler('Event from mqttrouter');
    //Hier ein event absetzen
  },

  switchON () {
    if (this.schalter.connected && this.schalter.state !== 'ON') {
      client.publish(_topic+'/cmnd/POWER', 'ON');
    }
  },

  switchOFF () {
    if (this.schalter.connected && this.schalter.state !== 'OFF') {
      client.publish(_topic+'/cmnd/POWER', 'OFF')
    }
  },
};

module.exports = mqttRouter;
