'use strict';


 const LeafConnect = require('./leaf-connect');
 const charging = require('./router/charging');


 async function main() {

  let lc = new LeafConnect('NE','stephan@mante.info','2389Ghost'); //NE
  charging.init(lc);
  charging.startProzess();


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
