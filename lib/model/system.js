//const Observable = require("hyperactiv/object/observable");
const Subscription = require('./subscription'),
      constants = require('../constants');

class System extends Subscription {
    
    constructor(service) {
        super(service);
        
        this.connectivity = { };
        this.bulletins = [ ];
        this.state = "disconnected";
        
        this.service.system().on("data", data => {
            if (data.code == 321) {
                if (!this.readOnly && data.message.indexOf("Read-Only") > 0) {
                    this.readOnly = true;
                    this.emit("connectivity", "API is in read-only mode. Orders cannot be placed.");
                }
            }
            else if (data.code == 1100 || data.code == 2110) {
                this.state = "disconnected";
            }
            else if (data.code == 1101 || data.code == 1102) {
                this.state = "connected";
            }
            else if (data.code == 1300) {
                this.state = "disconnected";
            }
            else if (data.code >= 2103 && data.code <= 2106 || data.code == 2119) {
                let name = data.message.from(data.message.indexOf(" is ") + 4).trim();
                name = name.split(":");

                let status = name[0];
                name = name.from(1).join(":");

                this.connectivity[name] = { name: name, status: status, time: Date.create() };   
            }
            else if (data.code >= 2107 && data.code <= 2108) {
                let name = data.message.trim();
                name = name.split(".");

                let status = name[0];
                name = name.from(1).join(".");

                this.connectivity[name] = { name: name, status: status, time: Date.create() };   
            }
            else if (data.code == 2148) {
                this.bulletins.push(data);
            }
            else if (data.code >= 2000 && data.code < 3000) {
                this.warning = data;
            }
            else {
                this.error = data;
            }
        });
        
        this.subscriptions.push(this.service.newsBulletins(true).on("data", data => {
            this.bulletins.push(data);
        }).on("error", err => {
            this.error = err;
        }).send());
        
        this.service.socket.on("connected", () => {
            this.state = "connected";
        }).on("disconnected", () => {
            this.state = "disconnected";
        });
    }
    
    get useFrozenMarketData() {
        return this.service.lastMktDataType == constants.MARKET_DATA_TYPE.frozen;
    }
    
    set useFrozenMarketData(value) {
        this.service.mktDataType(value ? constants.MARKET_DATA_TYPE.frozen : constants.MARKET_DATA_TYPE.live);
    }
    
}

module.exports = System;