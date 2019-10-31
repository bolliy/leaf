'use strict';

 const NissanConnect = require('./nissan-connect');
 const LeafConnect = require('./leaf-connect');
 const mqtt = require('./router/mqttrouter');
 const events = require('events');

 //create an object of EventEmitter class by using above reference
 var em = new events.EventEmitter();


 let lc = new LeafConnect('NE','stephan@mante.info','2389Ghost'); //NE
 mqtt.init(lc.schalter,handleEvent);

 let laden = {
    lastIsConnected:false,
    request:false,
    loading:false,
    percent:80,
    minutes:0,
    start:0,
    end:0,
 };



 // Raising FirstEvent
 //em.emit('FirstEvent', 'This is my first Node.js event emitter example.');
 //console.log(lc.schalter);

 //let nc = new NissanConnect('stephan@mante.info','2389Ghost');

 //Ladevorgang einleiten

 function handleEvent(reason) {
   em.emit('CalcCharing', reason);
 }

 async function charging() {
   let nowTime = new Date();
   nowTime.setTime(Date.now());
   if (laden.request && laden.end > nowTime) {
     if (nowTime >= laden.start && laden.minutes > 30) {
       laden.request = false;
       laden.loading = true;
       console.log('Der Ladevorgang wird jetzt gestartet...');
       mqtt.switchON();
       let res= await lc.battery.startCharging(lc.leaf,lc.customerInfo);
       console.log(res);
     }
   }
   //Abbruchbedingung
   if (laden.loading) {
     if (lc.batteryStatus.level > laden.percent || laden.loading && nowTime > laden.end) {
       laden.loading = false;
       console.log('Leaf ist fertig geladen.');
     }
     if (!lc.schalter.connected) {
       laden.loading = false;
       console.log('Ladekabel wurde entfernt. Der Ladevorgang wurde beendet.')
     };
     if (!laden.loading) {
       mqtt.switchOFF();
     }
   }
 };

 async function calcCharging(data) {

   console.log(data);

   console.log('calcCharging...');
   let pTime;
   let nowTime = new Date();
   nowTime.setTime(Date.now());
   pTime=passedTime(lc.batteryStatus.updateTime);

   //Voraussetzungen prüfen
   //Schalter connected und LadeKabel angeschlossen aber wird noch nicht geladen
   //TEST!!
   /*
   lc.schalter.connected=true;
   if (lc.batteryStatus.percentage===undefined) {
     lc.batteryStatus.percentage = 75; //
   } else {
     lc.batteryStatus.percentage ++;
   }
   pTime = 1*60000; //5 Minuten alt
   //TEST END;
   */

   console.log('Schalter: '+JSON.stringify(lc.schalter));
     // Änderung des PluginState
   if (laden.lastIsConnected != lc.batteryStatus.isConnected) {
     if (!laden.loading && !laden.request && lc.schalter.connected && lc.batteryStatus.isConnected && !lc.batteryStatus.isConnectedToQuickCharging) {
       //Einleitung
       laden.minutes = 0;
       laden.start = new Date(0); //1. Januar 1970 00:00:00 UTC
       laden.end  = new Date(0);  //1. Januar 1970 00:00:00 UTC
       laden.request = true; //Es soll geladen werden
     };
     laden.lastIsConnected = lc.batteryStatus.isConnected;
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
         charging();
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
       console.log('laden 3:'+laden.minutes);
       console.log('Leaf lädt seit '+ladeMinuten+' Minuten und wird noch '+laden.minutes+' Minuten laden.');
       //neuer Endzeit, sofern sich diese 15 Minuten zum vorherigen Wert unterscheidet.
       if (Math.abs(nowTime.valueOf() + laden.minutes*60000-laden.end)>15*60000) {
         laden.end = new Date(nowTime.valueOf() + laden.minutes*60000);
       }
     }
   };
   console.log(laden);
 };

 async function startChargingTask() {
   let ende=false;

   while (ende===false) {
     console.log('StartChargingTast');
     //TEST
     //calcCharging();
     charging();
     //console.log(laden);
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
  //Hier könnte der Aufruf calcCharging kommen
  //handleEvent('Event from getBattery ;)');
  console.log(lc.schalter);
};

async function startBatteryTask() {
  let ende=false;

  while (ende===false) {
    console.log('BatteryProcess NextTick');
    await getBattery().then( ()=> {
      console.log(lc.batteryStatus);
      handleEvent('Event from getBattery ;)');
    }).catch(err => {
      console.log('Fehler '+err);
      if (err===401) {
        console.log('not authorised');
      };
      lc.loggedIn = false;
    });
    if (lc.loggedIn===true) {
      await LeafConnect.timeout(5*60000); //statische 5 Minuten
    }
  }
}

async function main() {
  ///Subscribe for FirstEvent
   em.on('CalcCharing', calcCharging);
   startBatteryTask();
   startChargingTask();
   /*
   let ende=false;

   while (ende===false) {

     //Ladekabel angeschlossen und der Leaf lädt noch nicht
     //if (lc.schalter.connected && !lc.batteryStatus.isCharging && lc.schalter.state !== 'ON') {
     await calcCharging();
     charging();
     console.log(laden);
     //}
     await LeafConnect.timeout(1*60000); //statische 5 Minuten
     console.log('NextTick');
   };
  */
   console.log('#ENDE#');


   //AC controls
   /*
   await nc.acOn();
   await nc.acOff();

   await nc.setAcSchedule('2017-11-04 07:30');

   let schedule = await nc.getAcSchedule();

   console.log(schedule.targetDate);
   */
   // Battery status
   /*

   let status = await nc.getLastBatteryStatus();

   console.log('#### Capacity: '+status.capacity);

   console.log('#### Charge State:'+status.chargeState);
   console.log('#### Time to Full 3KW:'+status.timeToFull3kW);

   status = await nc.getBatteryStatus();
   console.log('#### Charge State:'+status.batteryStatus.chargeState);
   console.log('#### Time to Full 3KW:'+status.batteryStatus.timeToFull3kW);
   */
/*
    //Driving analysis
   let drivingAnalysis = await nc.getDrivingAnalysisWeek('2017-11-01');

   console.log(drivingAnalysis.startDate);
   drivingAnalysis.days.forEach(daySummary => {
     console.log(daySummary.targetDate);
     if (daySummary.hasData) {
      console.log(daySummary.averageEconomy);
      console.log(daySummary.regen);
     }
   });
   */

 }

main().catch(console.error);
