'use strict';

 const NissanConnect = require('./nissan-connect');
 const LeafConnect = require('./leaf-connect');

 //let lc = new LeafConnect('NE','stephan@mante.info','2389Ghost'); //NE

 let nc = new NissanConnect('stephan@mante.info','2389Ghost');

 let semaBattery = false;

function getBatteryInfo() {
  if (semaBattery===true) {
    return;
  }
  semaBattery = true;

  function timeDiff(time1,time2) {
    if (time2) {
      var lastTime = new Date(time2);
    } else {
      var lastTime = new Date(0); //1. Januar 1970 00:00:00 UTC
    }
    return time1-lastTime; //now - UpdateTime
  };

  var startTime = new Date();
  startTime.setTime(Date.now());
  console.log(startTime,lc.batteryStatus.updateTime);
  console.log(timeDiff(startTime,lc.batteryStatus.updateTime)+' ms');
  //5 Minuten alt
  if (timeDiff(startTime,lc.batteryStatus.updateTime) < 15*60000) {
    console.log('Daten aktuell!');
    return semaBattery = false;
  }

  lc.getLastBatteryStatus2( (err,status) => {
   //console.log('getLastBatteryStatus:');
     if (err) {
       console.log(err.message);
       return semaBattery = false;
     }
     console.log('1:getLastBatteryStatus2:');
     console.log(lc.batteryStatus);
     let datum = new Date(lc.batteryStatus.updateTime);
     console.log(datum.toLocaleString());
     console.log(lc.batteryStatus.percentage+' %');
     if (timeDiff(startTime,lc.batteryStatus.updateTime) > 15*60000) {
       lc.getBatteryStatus2( (err,status) => {
         if (err) {
           console.log(err.message);
           console.log('Ende BatteryInfo');
           return semaBattery = false;
         }
         console.log('2:getBatteryStatus2:');
         console.log(lc.batteryStatus);
         let datum = new Date(lc.batteryStatus.updateTime);
         console.log(datum.toLocaleString());
         console.log(lc.batteryStatus.percentage+' %');
      });
    } else {
      semaBattery = false;
    }
  });


}

 async function things() {

   //let res = await lc.login('stephan@mante.info','2389Ghost');
   //res = await lc.getLastBatteryStatus();
   //console.log(res);

   /*
   let ende=false;
   while (ende===false) {
     getBatteryInfo();
     console.log('NextTick');
     await LeafConnect.timeout(5*60000); //statische 30 Sekunden
   };
   */
   /*
   let status = await lc.getBatteryStatus();
   console.log('#### Charge State:'+status.batteryStatus.chargeState);
   console.log('#### Time to Full 3KW:'+status.batteryStatus.timeToFull3kW);
   */
   /*
   lc.getBatteryStatus2(status => {
     console.log(lc.batteryStatus);
     let datum = new Date(lc.batteryStatus.updateTime);
     console.log(datum.toLocaleString());
     console.log(lc.batteryStatus.percentage);
   }
   );
   */

   console.log('#ENDE#');


   /*

   //AC controls

   await nc.acOn();
   await nc.acOff();

   await nc.setAcSchedule('2017-11-04 07:30');

   let schedule = await nc.getAcSchedule();

   console.log(schedule.targetDate);
   */
   // Battery status

   let status = await nc.getLastBatteryStatus();

   console.log('#### Capacity: '+status.capacity);

   console.log('#### Charge State:'+status.chargeState);
   console.log('#### Time to Full 3KW:'+status.timeToFull3kW);

   status = await nc.getBatteryStatus();
   console.log('#### Charge State:'+status.batteryStatus.chargeState);
   console.log('#### Time to Full 3KW:'+status.batteryStatus.timeToFull3kW);
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

things().catch(console.error);
