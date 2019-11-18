'use strict';

const LeafConnect = require('../leaf-connect');
const charging = require('./charging');
const config = require('./config');
const mqtt = require('./mqttrouter');
//const events = require('events');
const Logger = require('../logger');

let status = {
  isOn : undefined,
  request : false,
  isConnected : false,
};

const ac = {
  init(nc) {
    //globale Varibale
    this.lc = nc;
    this.logger = new Logger('ac-router');
    //this.logger = new Logger(this.constructor.name);
 },
 async startProzess() {
   let ende=false;
   let res;
   while (ende===false) {
     //console.log('StartChargingTast');
     let laden = charging.getData();
     this.logger.log('##### mqtt :'+mqtt.connected);
     this.logger.log('Laden: '+JSON.stringify(laden));
     if (status.isON != false) {
       await this.lc.getAcRecord().then( (data)=> {
         status.isOn = data.isOn;
         status.isConnected = data.pluginState != 'NOT_CONNECTED';
         console.log(data.data);
         console.log('AC Status: '+JSON.stringify(status));
         }).catch(err => {
           this.logger.log(err);
       });
       this.publishMqtt(); //Klimaschalter 
     };
     await LeafConnect.timeout(30*60000); //statische 1 Minuten
   }
 },
 handleMqttEmittert(reason) {
   mqtt.subscribe('/control/climate',this.handleMqttEvent);
 },

 async handleMqttEvent(topic,message) {
   const _topic = mqtt.topic;
   console.log('handleMqttEvent ac');
   console.log(topic+' change to '+message.toString());
   switch (topic) {
      case _topic+'/control/climate':
        //ac umschalten...
        if (!status.request) {
          let turnOn = (message.toString() === 'ON');
          if (turnOn != status.isOn) {
            status.request = true;
            let ende=false;
            while (ende===false) {
              await ac.climaControl().then( () => {
                ende = true;
              }).catch( err => {
                ac.logger.log('ClimaControl Error '+err);
                if (err != 1000) {
                  ac.lc.loggedIn = false;
                }
              });
            }
          }
        }
        break;
    };
  },

  async climaControl() {
    if (status.request) {
      let res;
      if (status.isOn) {
        res = await this.lc.acOff();
        if (this.isConnected && !charging.getData().loading) {
          mqtt.switchOFF();
        }
      } else {
        //Wurde der Ladestecker gerade eingesteckt
        if (this.isConnected && charging.getData().request ) {
          mqtt.switchON();
        }
        res = await this.lc.acOn();
      };

      if (res.success) {
        status.isOn = !status.isOn; //toggle
        this.logger.log('Klimatesierung is '+status.isOn);
      } else {
        this.publishMqtt(); //Klimaschalter umschalten
      }
      status.request= false; //Request beenden
    }
  },

  isConnected () {
    return this.lc.batteryStatus.isConnected;
  },

  publishMqtt(){
    if (status.isOn) {
      mqtt.publish('/control/climate','ON');
    } else {
      mqtt.publish('/control/climate','OFF');
    }
  },
};



module.exports = ac;
