// controller.js
'use strict'

const mqtt = require('mqtt');
const config = require('./config');
const logger = require('../logger');

config.init();
//console.log(config.get("mqtt_ip"));
const client = mqtt.connect('mqtt://'+config.get("mqtt_ip"));
var subscribes = [];
var callbacks = [];

const mqttRouter = {
    connected : false,
    init(eventHandler) {
      this.eventHandler = eventHandler;
      this.topic = config.get("mqtt_topic");
      this.logger = new logger('mqttrouter');

      client.on('connect', () => {
        this.logger.log('mqtt connected');
        this.connected = true;
        this.eventHandler();
      });

      client.on('disconnect', () => {
        this.logger.log('mqtt disconnected');
        this.connected = false;
      });

      client.on('message', (topic, message) => {
         this.logger.log('Event mqtt message '+message);
         if (topic.indexOf(this.topic) === 0) {
           //CallBack(message)
           //console.log('client.on '+topic +' '+ message);
           return this.getCallbackFromTopic(topic)(topic,message);
         }
         this.logger.log('No handler for topic %s', topic)
     });
  },
  switchON () {
    client.publish(this.topic+'/charging/cmnd/POWER', 'ON');
  },
  switchOFF () {
    client.publish(this.topic+'/charging/cmnd/POWER', 'OFF');
  },
  subscribe(subTopic,callback) {
     this.logger.log('subscribe '+subTopic);
     client.subscribe(this.topic+subTopic,(err,grandet) =>{
       if (err) {
         this.logger.log(err.message);
         return;
       }
       //push ein JSON Object
       subscribes.push(JSON.parse('{"topic":"'+this.topic+subTopic+'"}'));
       callbacks.push(callback);
     });
  },
  getCallbackFromTopic(topic) {
    //syncron im Gegensatz zu foreach
    for (var i = 0; i < subscribes.length; i++) {
      if (subscribes[i].topic===topic) {
        //console.log(subscribes[i],callbacks[i], i);
        return callbacks[i];
      }
    }
    return null;
  },
  publish(subTopic,messages,options) {
    client.publish(this.topic+subTopic, messages.toString(),options);
  }
};

module.exports = mqttRouter;
