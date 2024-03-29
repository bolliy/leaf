'use strict';

//const needle = require('needle');

const request2 = require('request');
//const request = require('request-promise-native');
const crypto = require('crypto');
const logger = require('./logger');

const BatteryApi = require('./battery/battery-api');
const AcApi = require('./ac/ac-api');

const LoginResponse = require('./responses/login-response');
const Config = require('./config');

class leafAPI {
  constructor(region,username, password) {
    this.region = region;
    this.username = username;
    this.password = password;

    this.loggingIn = false; //Semaphore
    this.loggedIn = false;
    this.logger = new logger(this.constructor.name);

    //this.logger = new Logger(this.constructor.name);
    /**
     * @type {AcApi}
     */
    this.ac = new AcApi(this);
    /**
     * @type {BatteryApi}
     */
    this.battery = new BatteryApi(this);
    this.leaf = undefined;
    this.customerInfo = undefined;
    this.batteryStatus = {};
    //Muss schon hier bereists definiert werden, damit das Objekt an mqttrouter als Referenz weitergeleitet werden kann.
    this.schalter = {
      connected:false,
      state:''
    };

    /*
    this.carFinder = new CarFinderApi(this);

    this.drive = new DriveApi(this);
    */
  }


  async connect() {
    console.log('connecting');
    let res = await this.request("InitialApp_v2.php", {
      lg: 'en-US',
    });
    return res['baseprm'];
  }

  async login() {
    this.loggingIn = true; //Semaphore
    let key
    try {
      key = await this.connect();
      this.log('logging in with key '+key);
    } catch(err) {
      this.loggingIn = false;
      this.log('connect failed');
      throw err;
    };
    let res;
    try {
      res = await this.request("UserLoginRequest.php", {
        UserId: this.username,
        Password: this.encryptPassword(this.password, key)
       });
    } catch(err) {
      this.loggingIn = false;
      this.log('Login failed');
      throw err;
    }
    //console.log(res);
    //return res;
    this.loginres= new LoginResponse(res);
    this.leaf = this.loginres.leaf;
    this.customerInfo = this.loginres.customerInfo;
    this.loggingIn = false;
    this.loggedIn = true;   //nun eingelogged
    return this.loginres;
  }

  //
  //https://www.heise.de/developer/artikel/async-und-await-fuer-Node-js-3633105.html
  request(endPoint, data) {
    this.log('Aufruf request...');
    const defaults = {
      initial_app_str: Config.initialAppString,
      RegionCode: this.region
    };
    const options = {
      uri: Config.baseUrl + endPoint,
      method: 'POST',
      form: {},
      json: true
    };

    Object.assign(options.form, defaults, data);

    return new Promise((resolve, reject) => {
      request2(options, (err, response, body) => {
        if (err) {
          this.log(err.message);
          return reject(err);
        }
        if (typeof body === 'undefined') {
          return reject(new Error('Unexpected status code '))
        } else {
          if (body.status !== 200) {
          //return reject(new Error('Unexpected status code '+body.status));
            return reject(body.status);
          }
        }
        resolve(body);
      });
   });
 };

 //Request mit Errorhandling
 async requestB(endPoint, data) {
    this.checkLogin();
    this.log('Aufruf request with Errorhandling...');

    let res;
    try {
      res = await this.request(endPoint, data);
    } catch(err) {
      if (err === 401) {
        this.log('relogin...');
        await this.reLogin();
        this.log('erneuter requestPromise ...')
        return await this.request(endPoint, data); //rekusive
      }
      throw err; //benutzerdefinierte Exception erzeugen
    }

    let status = res.status;
    this.log('Request result:'+status);

    return res;
  }


  adjustBatteryStatus() {
    //TEST!!
    //this.batteryStatus.pluginState = 'CONNECTED';

    this.batteryStatus.percentage = Math.round(this.batteryStatus.Level*100/this.batteryStatus.capacity);
    if (this.batteryStatus.SOC) {
      this.batteryStatus.percentage = this.batteryStatus.SOC;
    };

    this.batteryStatus.isCharging = this.batteryStatus.chargeStatus !=  'NOT_CHARGING';
    this.batteryStatus.isConnectedToQuickCharging = this.batteryStatus.chargeStatus == 'QC_CONNECTED';
    /**
     * @typedef {string} ChargeStatusEnum
     * NOT_CHARGING
     * NORMAL_CHARGING
     * RAPIDLY_CHARGING
     * INVALID
     */
    //this.batteryStatus.chargeStatus = this.batteryStatus.chargeStatus;
    /**
     * @typedef {string} PluginStateEnum
     * NOT_CONNECTED
     * QC_CONNECTED
     * CONNECTED
     */
    this.batteryStatus.isConnected = this.batteryStatus.pluginState != 'NOT_CONNECTED';
    this.batteryStatus.updateTime = this.batteryStatus.updateTime+'Z';
  }


  async getLastBatteryStatus() {
    await this.checkLogin();
    //let api = this.api.battery;
    //this.log(this.customerInfo);
    //return this.battery.getStatusRecord(this.leaf,this.customerInfo);
    let res = await this.battery.getStatusRecord(this.leaf,this.customerInfo);
    this.batteryStatus.pluginState = res.pluginState;
    this.batteryStatus.chargeStatus = res.chargeStatus;
    this.batteryStatus.updateTime = res.updateTime;
    this.batteryStatus.capacity = res.capacity;
    this.batteryStatus.Level = res.chargeState;
    this.batteryStatus.SOC = null;
    this.batteryStatus.timeToFull3kW = res.timeToFull3kW;
    if (res.data.BatteryStatus.SOC) {
      this.batteryStatus.SOC = parseInt(res.data.BatteryStatus.SOC.Value);
    }

    this.adjustBatteryStatus();
    return res;
  }

  async getBatteryStatus() {
    await this.checkLogin();
    //let api = this.api.battery;
    //const key = await this.request(api, api.requestStatus);

    const key = await this.battery.requestStatus(this.leaf,this.customerInfo);
    let updateInfo = await this.battery.requestStatusResult(this.leaf, this.customerInfo, key);
    //let updateInfo = await this.api.battery.requestStatusResult(this.leaf, this.customerInfo, key);
    let count = 1;
    while (updateInfo === null) {
      if (count > 10) {
        return Promise.reject(1000);  //Mit Fehler 1000 abbrechen
      };
      count ++;
      this.log('retrying requestBatteryStatusResult');
      [updateInfo] = await Promise.all([
        this.battery.requestStatusResult(this.leaf, this.customerInfo, key),
        leafAPI.timeout(10000) //wait 10 seconds before continuing
      ]);
      /*
      await leafAPI.timeout(5000) //wait 5 seconds before continuing
      updateInfo = await this.battery.requestStatusResult(this.leaf, this.customerInfo, key);
      */
    }

    this.batteryStatus.pluginState = updateInfo.batteryStatus.pluginState;
    this.batteryStatus.Level = updateInfo.batteryStatus.chargeState;
    this.batteryStatus.updateTime = updateInfo.updateTime;
    this.batteryStatus.capacity = updateInfo.batteryStatus.capacity;
    this.batteryStatus.chargeStatus = updateInfo.batteryStatus.chargeMode;
    //console.log(updateInfo.batteryStatus.info);
    this.batteryStatus.SOC = null;
    this.batteryStatus.timeToFull3kW = updateInfo.batteryStatus.timeToFull3kW;
    this.adjustBatteryStatus();
    return updateInfo;
  }


  async acOn() {
    await this.checkLogin();
    //let api = this.api.ac;
    //const key = await this.request(api, api.requestOn);
    const key = await this.ac.requestOn(this.leaf, this.customerInfo);
    let updateInfo = await this.ac.requestOnResult(this.leaf, this.customerInfo, key);
    let count = 1;
    while (updateInfo === null) {
      if (count > 20) {
        return Promise.reject(1000);  //Mit Fehler 1000 abbrechen
      };
      count ++;
      this.log('retrying ac requestResult');
      [updateInfo] = await Promise.all([
        this.ac.requestOnResult(this.leaf, this.customerInfo, key),
        leafAPI.timeout(10000)
      ]);
    }
    return updateInfo;
  }

  /**
   * @returns {Promise.<AcOff>}
   */
  async acOff() {
    await this.checkLogin();
    //let api = this.api.ac;
    //const key = await this.request(api, api.requestOff);
    const key = await this.ac.requestOff(this.leaf, this.customerInfo);
    let updateInfo = await this.ac.requestOffResult(this.leaf, this.customerInfo, key);
    let count = 1;
    while (updateInfo === null) {
      if (count > 20) {
        return Promise.reject(1000);  //Mit Fehler 1000 abbrechen
      };
      count ++;
      this.log('retrying ac requestResult');
      [updateInfo] = await Promise.all([
        this.ac.requestOffResult(this.leaf, this.customerInfo, key),
        leafAPI.timeout(10000) //wait 10 seconds before continuing
      ]);
    }
    return updateInfo;
  }

  async getAcRecord() {
    this.log('getAcRecord');
    await this.checkLogin();
    return this.ac.getRecord(this.leaf, this.customerInfo);
  }

  async checkLogin() {
    this.log('checkLogin loggedIn = ' + this.loggedIn);
    if (this.loggedIn) {
      return;
    }
    if (this.loggingIn) {
      this.log('Loginprozess im Gange, ich warte.....')
      await leafAPI.timeout(2000); //statische Methode
      //return this.checkLogin(); 26.05.21
    }
    await this.login();
  }


  async reLogin() {
    this.log('not authorised, retrying');
    this.loggedIn = false;
    return this.checkLogin();
  }

  static timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  log(message) {
    this.logger.log(message);
  }

  encryptPassword(password, key) {
  //static encryptPassword(password, key) {
    //const cipher = crypto.createCipheriv('bf-ecb', new Buffer(key), new Buffer(''));
    const cipher = crypto.createCipheriv('bf-ecb', Buffer.from(key), Buffer.from(''));
    return cipher.update(password, 'utf8', 'base64') + cipher.final('base64');
  }

};


module.exports = leafAPI;
