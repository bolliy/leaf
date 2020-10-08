/**
 * @const
 */
const Config = {
  baseUrl: "https://gdcportalgw.its-mo.com/api_v200413_NE/gdc/",
  initialAppString: "9s5rfKVuMrT03RtzajWNcA",
  endPoints: {
    acRemote: "ACRemoteRequest.php",
    acRemoteCancel: "ACRemoteCancelRequest.php",
    acRemoteNew: "ACRemoteNewRequest.php",
    acRemoteOff: "ACRemoteOffRequest.php",
    acRemoteOffResult: "ACRemoteOffResult.php",
    acRemoteRecords: "RemoteACRecordsRequest.php",
    acRemoteResult: "ACRemoteResult.php",
    acRemoteStart: "ACRemoteStartRequest.php",
    acRemoteUpdate: "ACRemoteUpdateRequest.php",
    app: "InitialApp_v2.php",
    batteryChargingCompletionRecords: "BatteryChargingCompletionRecordsRequest.php",
    batteryRemoteCharging: "BatteryRemoteChargingRequest.php",
    batteryRemoteChargingRecords: "RemoteBatteryChargingRecordsRequest.php",
    batteryStatus: "BatteryStatusCheckRequest.php",
    batteryStatusRecords: "BatteryStatusRecordsRequest.php",
    batteryStatusResult: "BatteryStatusCheckResultRequest.php",
    carFinder: "MyCarFinderRequest.php",
    carFinderLatLng: "MyCarFinderLatLng.php",
    carFinderResult: "MyCarFinderResultRequest.php",
    carMapDetailCalender: "CarKarteDetailCalendarRequest.php",
    carMapDetailInfo: "CarKarteDetailInfoRequest.php",
    carMapDrivingNote: "CarKarteRegisterDrivingNoteRequest.php",
    carMapGraph: "car_karte_graph.php",
    carMapGraphInfo: "CarKarteGraphInfoRequest.php",
    contactNumber: "GetContactNumberResponse.php",
    countrySetting: "GetCountrySetting.php",
    dateFormat: "dateformat.php",
    driveAnalysis: "DriveAnalysisBasicScreenRequestEx.php",
    driveAnalysisDetail: "DriveAnalysisDetailRequest.php",
    ecoForestGraphInfo: "EcoForestGraphInfoRequest.php",
    ecoForestReset: "EcoForestResetRequest.php",
    ecoForestWorld: "world_eco_forest.php",
    login: "UserLoginRequest.php",
    missingRecords: "PluginMissingRecordsRequest.php",
    nationalRanking: "national_ranking_info.php",
    nationalRankingGraph: "national_ranking_graph.php",
    nationalRankings: "NationalRankingBasicScreenRequest.php",
    notificationHistory: "GetNotificationHistory.php",
    pathView: "PathViewer.php",
    preferenceNotification: "GetPreferenceNotification.php",
    preferenceNotificationRegister: "RegisterPreferenceNotification.php",
    priceSimulator: "PriceSimulatorDetailInfoRequest.php",
    priceSimulatorElectricPrice: "PriceSimulatorRegisterElectricPriceRequest.php",
    priceSimulatorMapData: "PriceSimulatorGetMapDataInfoRequest.php",
    regionSetting: "GetRegionSetting.php",
    routePlanner: "RoutePlanner.php",
    scheduledACRemote: "GetScheduledACRemoteRequest.php",
    vehicleInfo: "GetVehicleInfoRequest.php",
    worldRankingEntryCode: "WorldRankingRegisterEntryCodeRequest.php",
    worldRankingTop100: "WorldRankingTop100InfoRequestEx.php",
    worldRankingTopInfo: "WorldRankingTopInfoRequest.php"
  }
};

module.exports = Config;
