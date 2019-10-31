const BatteryStatusResponse = require('./battery-status-response');
const BatteryStatusLast = require('./battery-status-last');
const Config = require('../config');

/**
 *
 */
class BatteryApi {
  /**
   *
   * @param {NissanConnectApi} api
   */
  constructor(api) {
    this.api = api;
  }

  /**
   *
   * @param {Leaf} leaf
   * @param {CustomerInfo} customerInfo
   * @returns {Promise.<string>}
   */
  async requestStatus(leaf, customerInfo) {
    console.log('requesting battery status');
    let res = await this.api.request(Config.endPoints.batteryStatus, {
      lg: customerInfo.language,
      DCMID: leaf.dmcId,
      VIN: leaf.vin,
      tz: customerInfo.timezone,
      UserId: leaf.gdcUserId,
      custom_sessionid: leaf.sessionId
    });
    return res.resultKey;
  }

  /**
   *
   * @param {Leaf} leaf
   * @param {CustomerInfo} customerInfo
   * @param {string} resultKey
   * @returns {Promise.<BatteryStatusResponse|null>}
   */
  async requestStatusResult(leaf, customerInfo, resultKey) {
    this.api.log('requesting battery status result');
    //request von nissan-connect
    let res = await this.api.request(Config.endPoints.batteryStatusResult, {
      lg: customerInfo.language,
      DCMID: leaf.dmcId,
      VIN: leaf.vin,
      tz: customerInfo.timezone,
      resultKey: resultKey,
      custom_sessionid: leaf.sessionId
    });
    return res.responseFlag === '1' ? new BatteryStatusResponse(res) : null;
  }

  requestStatusResult2(leaf, customerInfo, resultKey,handle) {
    function localHandle(err,body){
      //console.log(body);
      let res = null;
      if (!err)  {
        if (body.responseFlag === '1') {
          res = new BatteryStatusResponse(body);
        };
      }
      handle(err,res); //calback an getBatteryStatus2.update
    };

    this.api.log('requesting battery status result');
    this.api.request2(Config.endPoints.batteryStatusResult, {
      lg: customerInfo.language,
      DCMID: leaf.dmcId,
      VIN: leaf.vin,
      tz: customerInfo.timezone,
      resultKey: resultKey,
      custom_sessionid: leaf.sessionId
    },localHandle);
  }

  /**
   * @param {Leaf} leaf
   * @param {CustomerInfo} customerInfo
   * @returns {Promise.<BatteryStatusLast>}
   */
  async getStatusRecord(leaf, customerInfo) {
    this.api.log('battery status record');
    let res = await this.api.request(Config.endPoints.batteryStatusRecords, {
      lg: customerInfo.language,
      DCMID: leaf.dmcId,
      VIN: leaf.vin,
      tz: customerInfo.timezone,
      custom_sessionid: leaf.sessionId
    });
    //console.log(res);
    return new BatteryStatusLast(res);
  }

  async getStatusRecord2(leaf, customerInfo, handle) {
    //wird von request2 aufgerufen
    function localHandle(err,body){
      if (err) {
        console.log('Fehler: getStatusRecord2');
        return handle(err);
      }
      const res = new BatteryStatusLast(body);
      handle(err,res); //getLastBatteryStatus2
    };
    this.api.log('battery status record');
    this.api.request2(Config.endPoints.batteryStatusRecords, {
      lg: customerInfo.language,
      DCMID: leaf.dmcId,
      VIN: leaf.vin,
      tz: customerInfo.timezone,
      custom_sessionid: leaf.sessionId
    },localHandle);
  }

  /**
   * @param {Leaf} leaf
   * @param {CustomerInfo} customerInfo
   * @return {Promise}
   */
  async startCharging(leaf, customerInfo) {
    this.api.log('start charging');
    return this.api.request(Config.endPoints.batteryRemoteCharging, {
      lg: customerInfo.language,
      DCMID: leaf.dmcId,
      VIN: leaf.vin,
      tz: customerInfo.timezone,
      custom_sessionid: leaf.sessionId
    });
  }

  /**
   * Returned error code 400
   * @deprecated
   * @param {Leaf} leaf
   * @param {CustomerInfo} customerInfo
   * @returns {Promise.<*>}
   */
  async getChargingCompletion(leaf, customerInfo) {
    this.api.log('battery charging completion');
    return this.api.request(Config.endPoints.batteryChargingCompletionRecords, {
      lg: customerInfo.language,
      DCMID: leaf.dmcId,
      VIN: leaf.vin,
      tz: customerInfo.timezone,
      custom_sessionid: leaf.sessionId
    });
  }

}

module.exports = BatteryApi;
