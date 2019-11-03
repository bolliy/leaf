// controller.js
'use strict'

const mqtt = require('mqtt');
const config = require('./config');
config.init();
//console.log(config.get("mqtt_ip"));
const client = mqtt.connect('mqtt://'+config.get("mqtt_ip"));
var _topic = config.get("mqtt_topic");
var subscribes = [];
var callbacks = [];

const mqttRouter = {
    schalter : undefined,
    connected : false,
    init(schalter,eventHandler) {
      this.schalter = schalter;
      this.eventHandler = eventHandler;

      client.on('connect', () => {
        console.log('mqtt connected');
        this.connected = true;
        eventHandler();
      });

      client.on('disconnect', () => {
        console.log('mqtt disconnected');
        this.connected = false;
      });

      client.on('message', (topic, message) => {
         console.log('Event mqtt message '+message);
         if (topic.indexOf(_topic) === 0) {
           //CallBack(message)
           //console.log('client.on '+topic +' '+ message);
           return this.getCallbackFromTopic(topic)(topic,message);
         }
         console.log('No handler for topic %s', topic)
     });
  },

    switchON () {
    if (this.schalter.connected && this.schalter.state !== 'ON') {
      client.publish(_topic+'/charging/cmnd/POWER', 'ON');
    }
  },

  switchOFF () {
    if (this.schalter.connected && this.schalter.state !== 'OFF') {
      client.publish(_topic+'/charging/cmnd/POWER', 'OFF')
    }
  },
  subscribe(subTopic,callback) {
     console.log('Call subscribe ... '+subTopic);
     client.subscribe(_topic+subTopic,(err,grandet) =>{
       if (err) {
         console.log(err.message);
         return;
       }
       //push ein JSON Object
       subscribes.push(JSON.parse('{"topic":"'+_topic+subTopic+'"}'));
       callbacks.push(callback);
       //console.log(this.getCallbackFromTopic(_topic+subTopic));
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
  publish(subTopic,messages,callback) {
    client.publish(_topic+subTopic, messages.toString(),callback);
  }
};

module.exports = mqttRouter;
