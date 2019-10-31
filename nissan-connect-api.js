const request = require('request-promise-native');
const crypto = require('crypto');
/*
const Logger = require('./logger');
*/
const Config = require('./config');

const AcApi = require('./ac/ac-api');
const BatteryApi = require('./battery/battery-api');
/*
const CarFinderApi = require('./car-finder/car-finder-api');
const DriveApi = require('./drive/drive-api');
*/
const LoginResponse = require('./responses/login-response');
const VehicleInfo = require('./responses/vehicle-info');

class NissanConnectApi {

  constructor(region) {
    this.region = region;
    //this.logger = new Logger(this.constructor.name);
    /**
     * @type {AcApi}
     */
    this.ac = new AcApi(this);
    /**
     * @type {BatteryApi}
     */
    this.battery = new BatteryApi(this);
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
  async login(username, password) {
    const key = await this.connect();
    console.log('logging in');
    let res = await this.request(Config.endPoints.login, {
      UserId: username,
      Password: NissanConnectApi.encryptPassword(password, key)
    });
    console.log(res);
    //return res;
    return new LoginResponse(res);
  }

  async getVehicleInfo(leaf, customerInfo) {
    this.logger.log('vehicle info');
    let res = await this.request(Config.endPoints.vehicleInfo, {
      lg: customerInfo.language,
      DCMID: leaf.dmcId,
      VIN: leaf.vin,
      custom_sessionid: leaf.sessionId
    });
    //return res;
    return new VehicleInfo(res);
  }


  async getCountries(leaf, customerInfo) {
    this.logger.log('countries');
    return this.request(Config.endPoints.countrySetting, {
      lg: customerInfo.language,
      DCMID: leaf.dmcId,
      VIN: leaf.vin,
      custom_sessionid: leaf.sessionId
    });
  }

  /**
   * @param {Leaf} leaf
   * @param {CustomerInfo} customerInfo
   * @returns {Promise.<*>}
   */
  async getRegionSettings(leaf, customerInfo) {
    this.logger.log('region');
    return this.request(Config.endPoints.regionSetting, {
      lg: customerInfo.language,
      DCMID: leaf.dmcId,
      VIN: leaf.vin,
      custom_sessionid: leaf.sessionId
    });
  }

  /**
   * Returns 404
   * @deprecated
   * @param leaf
   * @param customerInfo
   * @returns {Promise.<*>}
   */
  async getContactNumbers(leaf, customerInfo) {
    this.logger.log('contact numbers');
    return this.request(Config.endPoints.contactNumber, {
      lg: customerInfo.language,
      DCMID: leaf.dmcId,
      VIN: leaf.vin,
      custom_sessionid: leaf.sessionId
    });
  }

  /**
   *
   * @param {Leaf} leaf
   * @param {CustomerInfo} customerInfo
   * @returns {Promise.<*>}
   */
  async getDisplayDate(leaf, customerInfo) {
    this.logger.log('display date');
    return this.request(Config.endPoints.dateFormat, {
      lg: customerInfo.language,
      DCMID: leaf.dmcId,
      VIN: leaf.vin,
      custom_sessionid: leaf.sessionId
    });
  }


  /**
   * Make a request to the Nissan Connect end point
   * @param {string} endPoint
   * @param {object} data
   * @returns {Promise.<*>}
   */
   //OK
  async request(endPoint, data) {
    console.log('Aufruf API Request ...');
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
    console.log('Request '+JSON.stringify(options));
    let res = await request(options);
    let status = res.status;
    if(status !== 200) {
      console.error(res);
      return Promise.reject(status);
    }
    return res;
  }


  async requestHtml(endPoint, data) {
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
    return request(options);
  }

  log(message) {
    console.log(message);
    //this.logger.log(message);
  }

  static encryptPassword(password, key) {
    const cipher = crypto.createCipheriv('bf-ecb', new Buffer(key), new Buffer(''));

    return cipher.update(password, 'utf8', 'base64') + cipher.final('base64');
  }
}

module.exports = NissanConnectApi;
