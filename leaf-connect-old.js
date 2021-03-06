'use strict';

//const needle = require('needle');

const request2 = require('request');
const request = require('request-promise-native');
const crypto = require('crypto');

const BatteryApi = require('./battery/battery-api');
const LoginResponse = require('./responses/login-response');
const Config = require('./config');


class leafAPI {
  constructor(region,username, password) {
    this.region = region;
    this.username = username;
    this.password = password;

    this.loggingIn = false; //Semaphore
    this.loggedIn = false;

    //this.logger = new Logger(this.constructor.name);
    /**
     * @type {AcApi}
     */
    //this.ac = new AcApi(this);
    /**
     * @type {BatteryApi}
     */
    this.battery = new BatteryApi(this);
    this.leaf = undefined;
    this.customerInfo = undefined;
    this.batteryStatus = {};

    /*
    this.carFinder = new CarFinderApi(this);

    this.drive = new DriveApi(this);
    */
  }

  //OK
  async connect() {
    console.log('connecting');
    let res = await this.request("InitialApp_v2.php", {
      lg: 'en-US',
    });
    return res['baseprm'];
  }
  //OK
  async login() {
    this.loggingIn = true; //Semaphore
    const key = await this.connect();
    console.log('logging in with key '+key);
    let res = await this.request("UserLoginRequest.php", {
      UserId: this.username,
      Password: this.encryptPassword(this.password, key)
    });
    //console.log(res);
    this.loginres= new LoginResponse(res);
    this.leaf = this.loginres.leaf;
    this.customerInfo = this.loginres.customerInfo;
    this.loggingIn = false;
    this.loggedIn = true;   //nun eingelogged
    console.log('logged in');
    return this.loginres;
  }

  //
  //https://www.heise.de/developer/artikel/async-und-await-fuer-Node-js-3633105.html
  request(endPoint, data) {
    console.log('Aufruf request...');
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
          console.log(err.message);
          return reject(err);
        }
        if (body.status !== 200) {
          //return reject(new Error('Unexpected status code '+body.status));
          return reject(body.status);
        }
  //      return reject(new Error('#Unexpected status code '+body.status));
        resolve(body);
    });
  });
 };

 //Request mit Errorhandling
 async requestB(endPoint, data) {
    this.checkLogin();
    console.log('Aufruf request with Errorhandling...');

    let res;
    try {
      res = await this.requestPromise(endPoint, data);
    } catch(err) {
      if (err === 401) {
        console.log('relogin...');
        await this.reLogin();
        console.log('erneuter requestPromise ...')
        return await this.request(endPoint, data); //rekusive
      }
      throw err; //benutzerdefinierte Exception erzeugen
    }

    let status = res.status;
    console.log('Request result:'+status);

    return res;
  }


  adjustBatteryStatus() {
    this.batteryStatus.percentage = Math.round(this.batteryStatus.Level*100/this.batteryStatus.capacity);
    this.batteryStatus.isCharging = this.batteryStatus.chargeStatus !=  'NOT_CHARGING';
    this.batteryStatus.isConnected = this.batteryStatus.pluginState != 'NOT_CONNECTED';
    this.batteryStatus.updateTime = this.batteryStatus.updateTime+'Z';
  }

  async getLastBatteryStatus() {
    await this.checkLogin();
    //let api = this.api.battery;
    this.log(this.customerInfo);
    return this.battery.getStatusRecord(this.leaf,this.customerInfo);
    //return this.request(api, api.getStatusRecord);
  }


  async getBatteryStatus() {
    await this.checkLogin();
    //let api = this.api.battery;
    //const key = await this.request(api, api.requestStatus);

    const key = await this.battery.requestStatus(this.leaf,this.customerInfo);
    let updateInfo = await this.battery.requestStatusResult(this.leaf, this.customerInfo, key);
    //let updateInfo = await this.api.battery.requestStatusResult(this.leaf, this.customerInfo, key);

    while (updateInfo === null) {
      console.log('retrying requestBatteryStatusResult');

      [updateInfo] = await Promise.all([
        this.battery.requestStatusResult(this.leaf, this.customerInfo, key),
        leafAPI.timeout(10000) //wait 5 seconds before continuing
      ]);
      /*
      await leafAPI.timeout(5000) //wait 5 seconds before continuing
      updateInfo = await this.battery.requestStatusResult(this.leaf, this.customerInfo, key);
      //leafAPI.timeout(5000) //wait 5 seconds before continuing
      */
    }
    return updateInfo;
  }


  async checkLogin() {
    console.log('checkLogin loggedIn = ' + this.loggedIn);
    if (this.loggedIn) {
      return;
    }
    if (this.loggingIn) {
      console.log('Loginprozess im Gange, ich warte.....')
      await leafAPI.timeout(2000); //statische Methode
      return this.checkLogin();
    }
    await this.login();
  }


  async reLogin() {
    console.log('not authorised, retrying');
    this.loggedIn = false;
    return this.checkLogin();
  }

  static timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  log(message) {
    console.log(message);
    //this.logger.log(message);
  }

  encryptPassword(password, key) {
  //static encryptPassword(password, key) {
    //const cipher = crypto.createCipheriv('bf-ecb', new Buffer(key), new Buffer(''));
    const cipher = crypto.createCipheriv('bf-ecb', Buffer.from(key), Buffer.from(''));

    return cipher.update(password, 'utf8', 'base64') + cipher.final('base64');
  }

};


module.exports = leafAPI;
