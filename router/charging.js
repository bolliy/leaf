'use strict';

 //const NissanConnect = require('./nissan-connect');
 const LeafConnect = require('../leaf-connect');
 const config = require('./config');
 const mqtt = require('./mqttrouter');
 const events = require('events');

 //create an object of EventEmitter class by using above reference
 var em = new events.EventEmitter();

 let lc;

 let laden = {
    lastIsConnected:undefined,
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
     mqtt.init(lc.schalter,handleEvent);
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
  }
 };

 function handleEvent(reason) {
   mqtt.subscribe('/charging/activ',handleMqttEvent);
   mqtt.subscribe('/charging/pause',handleMqttEvent);
   mqtt.subscribe('/charging/tele/LWT',handleMqttEvent); /* Online/offline */
   mqtt.subscribe('/charging/stat/POWER',handleMqttEvent); /* ON/OFF */
 }

 async function handleMqttEvent(topic,message) {
   console.log('handleMqttEvent');
   const _topic = config.get("mqtt_topic");
   console.log(topic+' change to %s ', message);
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
        console.log(message.toString())
        break;
      case _topic+'/charging/pause':
        console.log(message.toString());
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
   if (laden.request && laden.end > nowTime) {
     if (nowTime >= laden.start && laden.minutes > 30) {
       laden.request = false;
       laden.loading = true;
       console.log('Der Ladevorgang wird jetzt gestartet...');
       mqtt.switchON();
       let res= await lc.battery.startCharging(lc.leaf,lc.customerInfo);
       //console.log(res);
     }
   }
   //Abbruchbedingung
   if (laden.loading) {
     if (lc.batteryStatus.level >= laden.percent || nowTime > laden.end) {
       laden.loading = false;
       console.log('Leaf ist fertig geladen. '+lc.batteryStatus.level+'%');
     }
     if (!lc.batteryStatus.isConnected) {
       laden.loading = false;
       console.log('Ladekabel wurde entfernt. Der Ladevorgang wurde beendet.')
     };
    if (lc.schalter.state === 'OFF') {
       laden.loading = false;
       console.log('Ladesteckdose wurde ausgeschaltet. Der Ladevorgang wurde beendet.')
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
   console.log('calcCharging...');
   let nowTime = new Date();
   nowTime.setTime(Date.now());
   let pTime=passedTime(lc.batteryStatus.updateTime);

   //console.log('Schalter: '+JSON.stringify(lc.schalter));
   //Status des Ladekabel hat sich geändert
   if (laden.lastIsConnected != lc.batteryStatus.isConnected) {
     if (!laden.pause && !laden.loading && !laden.request && lc.schalter.connected && lc.batteryStatus.isConnected && !lc.batteryStatus.isConnectedToQuickCharging) {
       //Einleitung
       laden.minutes = 0;
       laden.start = new Date(0); //1. Januar 1970 00:00:00 UTC
       laden.end  = new Date(0);  //1. Januar 1970 00:00:00 UTC
       laden.request = true; //Es soll geladen werden
     };
     laden.lastIsConnected = lc.batteryStatus.isConnected;
     laden.pause = false; //Pause wieder aufheben
   };
   //Gibt es ein Request aber das Kabel wurde abgzogen
   if (laden.request && !lc.batteryStatus.isConnected ) {
     laden.request = false;
   }

   //Wie alt sind die Batteriedaten in Millisekunden?
   console.log('Alter der Batteriedaten '+Math.trunc(pTime/60000)+' Minuten');
   //Soll der Leaf laden oder lädt er schon
   //console.log('Request: '+laden.request+' loading: '+laden.loading);
   if (laden.request || laden.loading) {
     //Wie alt ist der Batteriestatus
     //TEST
     //laden.minutes = 61; //10 Minuten test
     if (pTime < 12*60*60000) {   //kleiner 12 Stunde
       //Ladezeit berechnen in Minuten
       laden.minutes = Math.round(900 * (laden.percent - lc.batteryStatus.percentage)/100);
     } else {
       laden.minutes = 0; //alten Daten keine Ladung!
     }

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
         calcTime.setHours('07');
         const nextDay = calcTime.valueOf() + 24*60*60000; //07.00h am nächsten Tag fertig geladen sein.
         if (nextDay-laden.minutes*60000 > nowTime.valueOf()) {
           laden.start = new Date(nextDay-laden.minutes*60000); //NexDay - Ladezeit
         }
       }
       laden.end = new Date(laden.start.valueOf() + laden.minutes*60000);
       if (laden.start = nowTime) {
         chargingProzess();
       }
     } else {
       //Neue LadeEndZeit berechnen
       //wie lange wird der Leaf schon geladen
       const ladeMinuten = Math.trunc((nowTime.valueOf() - laden.start.valueOf())/60000);
       //Der Batteriestatus neuer zum Ladestart
       let helpTime = new Date(lc.batteryStatus.updateTime);
       if (laden.start.valueOf() <  helpTime) {
         console.log(laden.minutes+' abzüglich '+Math.trunc(pTime/60000));
         laden.minutes = laden.minutes - Math.trunc(pTime/60000); //abzüglich des Batteriestatusalters in ms
       } else {
         laden.minutes = laden.minutes - ladeMinuten;
       }
       console.log('Leaf lädt seit '+ladeMinuten+' Minuten und wird noch '+laden.minutes+' Minuten laden.');
       //neuer Endzeit, sofern sich diese 15 Minuten zum vorherigen Wert unterscheidet.
       if (Math.abs(nowTime.valueOf() + laden.minutes*60000-laden.end)>15*60000) {
         laden.end = new Date(nowTime.valueOf() + laden.minutes*60000);
       }
     }
   };
   console.log(laden);
   console.log('### END calcCharging ###')
 };

 async function startChargingTask() {
   let ende=false;

   while (ende===false) {
     //console.log('StartChargingTast');
     chargingProzess();
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
    console.log('Batteriedaten aktuell');
    return;
  }
  //TEST
  //return;
  let res = await lc.getLastBatteryStatus();
  console.log(JSON.stringify(res));
  console.log(lc.batteryStatus);
  let datum = new Date(lc.batteryStatus.updateTime);
  console.log(datum.toLocaleString());
  console.log(lc.batteryStatus.percentage+' %');
  if (passedTime(lc.batteryStatus.updateTime) > 15*60000) {
    let status = await lc.getBatteryStatus();
    console.log(lc.batteryStatus);
    datum = new Date(lc.batteryStatus.updateTime);
    console.log(datum.toLocaleString());
    console.log(lc.batteryStatus.percentage+' %');

    console.log('#### Charge State:'+status.batteryStatus.chargeState);
    console.log('#### Time to Full 3KW:'+status.batteryStatus.timeToFull3kW);
  };

  //console.log(lc.schalter);
};

async function startBatteryTask() {
  let ende=false;
  while (ende===false) {
    let minuten=5;
    console.log('BatteryProcess NextTick');
    await getBattery().then( ()=> {
      //console.log(lc.batteryStatus);
      //BatteryStaus an mqtt senden
      mqtt.publish('/status/battery_percent',lc.batteryStatus.percentage);
      mqtt.publish('/status/connected',lc.batteryStatus.isConnected);
      mqtt.publish('/status/charging_status',lc.batteryStatus.chargeStatus);
      const datum = new Date(lc.batteryStatus.updateTime);
      mqtt.publish('/status/last_updated',datum.toLocaleString());
      calcCharging();
      //em.emit('CalcCharing');
      //handleEvent('Event from getBattery ;)');
    }).catch(err => {
      console.log('Fehler '+err);
      if (err===401) {
        console.log('not authorised');
        minuten = 0,5;
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
