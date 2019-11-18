'use strict';

 //const NissanConnect = require('./nissan-connect');
 const LeafConnect = require('../leaf-connect');
 const config = require('./config');
 const mqtt = require('./mqttrouter');
 const events = require('events');
 const Logger = require('../logger');

 //create an object of EventEmitter class by using above reference
 const em = new events.EventEmitter();
 const log = new Logger('charging');


 let lc;

 let laden = {
    wasConnected:undefined,
    aktiv:true,
    pause:false,
    request:false,
    loading:false,
    percent:80,
    minutes:0,
    start:0,
    end:0,
 };

 const charging = {
   init(nc){
     //globale Varibale
     lc = nc;
  },
  startProzess() {
    em.on('CalcCharing', calcCharging);
    startBatteryTask();
    startChargingTask();
  },
  getData(){
    return laden;
  },
  setData(data) {
    laden = data;
  },
  handleMqttEmitter() {
    mqtt.subscribe('/charging/activ',handleMqttEvent);
    mqtt.subscribe('/charging/pause',handleMqttEvent);
    mqtt.subscribe('/charging/up-to-percent',handleMqttEvent);
    mqtt.subscribe('/charging/tele/LWT',handleMqttEvent); /* Online/offline */
    mqtt.subscribe('/charging/stat/POWER',handleMqttEvent); /* ON/OFF */
  },

};


 async function handleMqttEvent(topic,message) {
   log.log('handleMqttEvent');
   const _topic = mqtt.topic;
   log.log(topic+' change to '+message.toString());
   switch (topic) {
      case _topic+'/charging/tele/LWT':
        let connected = (message.toString() === 'online');
        lc.schalter.connected = connected;
        calcCharging();
        //em.emit('CalcCharing');
        break;
      case _topic+'/charging/stat/POWER':
        lc.schalter.state = message.toString();
        calcCharging();
        //em.emit('CalcCharing');
        break;
      case _topic+'/charging/activ':
        let activ = (message.toString() === 'ON');
        if (laden.aktiv != activ) {
          laden.aktiv = activ;
          calcCharging();
        }
        break;
      case _topic+'/charging/pause':
        let pause = (message.toString() === 'ON');
        if (laden.pause != pause) {
          laden.pause = pause;
          calcCharging();
        }
        break;
      case _topic+'/charging/up-to-percent':
        let percent = parseInt(message.toString());
        if (laden.percent != percent) {
          laden.percent = parseInt(message.toString());
          calcCharging();
        }
        break;
   }
 };

 //Statet und stoppet de Ladeprozess
 async function chargingProzess() {
   if (!laden.aktiv) {
     return
   };
   let nowTime = new Date();
   nowTime.setTime(Date.now());
   if (laden.request && !laden.pause && laden.end > nowTime) {
     if (nowTime >= laden.start && laden.minutes > 30) {
       laden.request = false;
       laden.loading = true;
       log.log('Der Ladevorgang wird jetzt gestartet...');
       mqtt.switchON();
       let res= await lc.battery.startCharging(lc.leaf,lc.customerInfo);
     }
   }
   //Abbruchbedingung
   if (laden.request && !lc.batteryStatus.isConnected) {
     laden.request = false;
   };

   if (laden.loading) {
     if (lc.batteryStatus.level >= laden.percent || nowTime > laden.end) {
       laden.loading = false;
       log.log('Leaf ist fertig geladen. '+lc.batteryStatus.level+'%');
     }
     if (!lc.batteryStatus.isConnected) {
       laden.loading = false;
       log.log('Ladekabel wurde entfernt. Der Ladevorgang wurde beendet.')
     };
     if (lc.schalter.state === 'OFF') {
       laden.loading = false;
       log.log('Ladesteckdose wurde ausgeschaltet. Der Ladevorgang wurde beendet.')
     };
     if (!laden.loading) {
       mqtt.switchOFF();
     }
   }
 };

 //Berechnet der Ladeinformationen
 async function calcCharging(data) {
   if (!laden.aktiv) {
     return;
   };
   const oldLaden = Object.assign({},laden); //klonen ; keine Referenz
   let pTime=passedTime(lc.batteryStatus.updateTime);
   let ladeMinuten = 0;
   if (pTime < 12*60*60000) {   //kleiner 12 Stunde
     //Ladezeit berechnen in Minuten
     ladeMinuten = Math.round(900 * (laden.percent - lc.batteryStatus.percentage)/100);
   }
   log.log('calcCharging...');
   //console.log('Schalter: '+JSON.stringify(lc.schalter));
   //Status des Ladekabel hat sich geändert
   if (laden.wasConnected != lc.batteryStatus.isConnected) {
     if (!laden.loading
          && !laden.request
          && lc.schalter.connected
          && lc.batteryStatus.isConnected
          && !lc.batteryStatus.isConnectedToQuickCharging
          && ladeMinuten > 0) {
       //requestBatteryStatusResult
       laden.minutes = 0;
       laden.start = new Date(0); //1. Januar 1970 00:00:00 UTC
       laden.end  = new Date(0);  //1. Januar 1970 00:00:00 UTC
       laden.request = true; //Es soll geladen werden
     };
     //Pausieren und das Ladekabel wurde entfernt
     if (laden.pause && !lc.batteryStatus.isConnected) {
        laden.pause = false; //Pause wieder aufheben
        mqtt.publish('/charging/pause','OFF');
     };
     laden.wasConnected = lc.batteryStatus.isConnected;
   };
   //Gibt es ein Request aber das Kabel wurde abgzogen
   if (laden.request && !lc.batteryStatus.isConnected ) {
     laden.request = false;
   };
   //Wie alt sind die Batteriedaten in Millisekunden?
   log.log('Alter der Batteriedaten '+Math.trunc(pTime/60000)+' Minuten');
   //Soll der Leaf laden oder lädt er schon
   //console.log('Request: '+laden.request+' loading: '+laden.loading);
   if (laden.request || laden.loading) {
     let nowTime = new Date();
     nowTime.setTime(Date.now());
     //Wie alt ist der Batteriestatus
     laden.minutes = ladeMinuten;
     //Ladezeit berechnen
     if (!laden.loading) {
       let calcTime = new Date(nowTime.valueOf());
       calcTime.setHours('19'); //Nach 19.00
       calcTime.setMinutes(0);
       calcTime.setSeconds(0);

       laden.start = new Date(nowTime.valueOf()); //jetzt laden

       //nach 19.00h
       //if (false) {
       if (nowTime > calcTime) {
         calcTime.setHours('7');
         const nextDay = calcTime.valueOf() + 24*60*60000; //07.00h am nächsten Tag fertig geladen sein.
         if (nextDay-laden.minutes*60000 > nowTime.valueOf()) {
           laden.start = new Date(nextDay-laden.minutes*60000); //NexDay - Ladezeit
         }
       }
       laden.end = new Date(laden.start.valueOf() + laden.minutes*60000);
       //log.log(laden);
       if (laden.start === nowTime) {
         chargingProzess();
       }
       //log.log(laden);
     } else {
       //Neue LadeEndZeit berechnen
       //wie lange wird der Leaf schon geladen
       const ladeMinuten = Math.trunc((nowTime.valueOf() - laden.start.valueOf())/60000);
       //Der Batteriestatus neuer zum Ladestart
       let helpTime = new Date(lc.batteryStatus.updateTime);
       if (laden.start.valueOf() <  helpTime) {
         log.log(laden.minutes+' abzüglich '+Math.trunc(pTime/60000));
         laden.minutes = laden.minutes - Math.trunc(pTime/60000); //abzüglich des Batteriestatusalters in ms
       } else {
         laden.minutes = laden.minutes - ladeMinuten;
       }
       log.log('Leaf lädt seit '+ladeMinuten+' Minuten und wird noch '+laden.minutes+' Minuten laden.');
       //neuer Endzeit, sofern sich diese 15 Minuten zum vorherigen Wert unterscheidet.
       if (Math.abs(nowTime.valueOf() + laden.minutes*60000-laden.end)>15*60000) {
         laden.end = new Date(nowTime.valueOf() + laden.minutes*60000);
       }
     }
   };
   //log.log(laden);
   let datum;
   if (laden.start != oldLaden.start) {
     datum = new Date(laden.start);
     mqtt.publish('/charging/start',datum.toLocaleString(),{retain: true});
   };
   if (laden.end != oldLaden.end) {
     datum = new Date(laden.end);
     mqtt.publish('/charging/end',datum.toLocaleString(),{retain: true});
   };
   //console.log('++++++'+laden.minutes+' old '+oldLaden.minutes);
   if (laden.minutes != oldLaden.minutes) {
     mqtt.publish('/charging/minutes',laden.minutes,{retain: true});
   };
   log.log(laden);
   log.log('### END calcCharging ###')
 };

 async function startChargingTask() {
   let ende=false;

   while (ende===false) {
     //console.log('StartChargingTast');
     chargingProzess();
     //mqtt.publish('/charging/minutes',laden.minutes,'{"retain":"true"}');

     await LeafConnect.timeout(1*60000); //statische 1 Minuten
   };
 }

 function passedTime(time) {
   let startTime = new Date();
   startTime.setTime(Date.now());

   if (time) {
     var lastTime = new Date(time);
   } else {
     var lastTime = new Date(0); //1. Januar 1970 00:00:00 UTC
   }
   return startTime-lastTime; //now - UpdateTime
 };

async function getBattery() {
  //15 Minuten alt
  if (passedTime(lc.batteryStatus.updateTime) < 15*60000) {
    log.log('Batteriedaten aktuell');
    return;
  }
  //TEST
  //return;
  let res = await lc.getLastBatteryStatus();
  //console.log(JSON.stringify(res));
  log.log(JSON.stringify(lc.batteryStatus));
  let datum = new Date(lc.batteryStatus.updateTime);
  log.log(datum.toLocaleString());
  log.log(lc.batteryStatus.percentage+' %');
  if (passedTime(lc.batteryStatus.updateTime) > 15*60000) {
    let status = await lc.getBatteryStatus();
    log.log(lc.batteryStatus);
    datum = new Date(lc.batteryStatus.updateTime);
    log.log(datum.toLocaleString());
    log.log(lc.batteryStatus.percentage+' %');

    log.log('#### Charge State:'+status.batteryStatus.chargeState);
    log.log('#### Time to Full 3KW:'+status.batteryStatus.timeToFull3kW);
  };

  //console.log(lc.schalter);
};

async function startBatteryTask() {
  let ende=false;
  while (ende===false) {
    let lastBatteryStatus = Object.assign({},lc.batteryStatus); //Klonen
    let minuten=1;
    log.log('BatteryProcess NextTick');
    await getBattery().then( ()=> {
      //console.log(lc.batteryStatus);
      //BatteryStaus an mqtt senden
      if (lastBatteryStatus.percentage != lc.batteryStatus.percentage) {
        mqtt.publish('/status/battery_percent',lc.batteryStatus.percentage);
      };
      if (lastBatteryStatus.isConnected != lc.batteryStatus.isConnected) {
        mqtt.publish('/status/connected',lc.batteryStatus.isConnected);
      }
      if (lastBatteryStatus.chargeStatus != lc.batteryStatus.chargeStatus) {
        mqtt.publish('/status/charging_status',lc.batteryStatus.chargeStatus);
      }
      if (lastBatteryStatus.updateTime != lc.batteryStatus.updateTime) {
        const datum = new Date(lc.batteryStatus.updateTime);
        mqtt.publish('/status/last_updated',datum.toLocaleString());
      }
      calcCharging();
      //em.emit('CalcCharing');
      //handleEvent('Event from getBattery ;)');
    }).catch(err => {
      log.log('Fehler '+err);
      minuten = 0.1;
      if (err===401) {
        log.log('not authorised');
      };
      if (err==408) {
        log.log('timeout');
      };
      //
      if (err != 1000) {
        minuten = 2;
        lc.loggedIn = false;
      }
    });
    //console.log(lc.schalter);
    await LeafConnect.timeout(minuten*60000); //statische 5 Minuten
  }
}


module.exports = charging;
