"use strict";

require("sugar").extend();

const MarketData = require("./marketdata"),
      flags = require("../flags"),
      TICKS = flags.QUOTE_TICK_TYPES;

class Quote extends MarketData {
    
    constructor(session, contract) {
        super(session, contract);
        this._fieldTypes = [ ];
        this._exclude.push("_fieldTypes");
    }
    
    addFieldTypes(fieldTypes) {
        if (fieldTypes) {
            this._fieldTypes.add(fieldTypes);
        }
        
        return this;
    }
    
    pricing() {
        this._fieldTypes.add([ TICKS.markPrice, TICKS.auctionValues, TICKS.realTimeVolume ]);
        return this;
    }
    
    fundamentals() {
        this._fieldTypes.add([ TICKS.dividends, TICKS.fundamentalValues, TICKS.fundamentalRatios, TICKS.miscellaneousStats ]);
        return this;
    }
    
    volatility() {
        this._fieldTypes.add([ TICKS.historicalVolatility, TICKS.optionImpliedVolatility, TICKS.realtimeHistoricalVolatility ]);
        return this;
    }
    
    options() {
        this._fieldTypes.add([ TICKS.optionVolume, TICKS.optionOpenInterest ]);
        return this;
    }
    
    futures() {
        this._fieldTypes.add([ TICKS.futuresOpenInterest ]);
        return this;
    }
    
    short() {
        this._fieldTypes.add([ TICKS.shortable, TICKS.inventory ]);
        return this;
    }
    
    news() {
        this._fieldTypes.add([ TICKS.news ]);
        return this;
    }
    
    snapshot(cb) {
        let state = { };
        this.session.service.mktData(this.contract.summary, this._fieldTypes.join(","), true)
            .on("data", datum => {
                datum = parseQuotePart(datum);
                state[datum.key] = datum.value;
            }).on("error", (err, cancel) => {
                cb(err, state);
                cb = null;
                cancel();
            }).on("end", cancel => {
                cb(null, state);
                cb = null;
                cancel();
            }).send();
        
        return this;
    }
    
    stream() {
        let req = this.session.service.mktData(this.contract.summary, this._fieldTypes.join(","), false);
        
        this.cancel = () => req.cancel();
        
        req.on("data", datum  => {
            datum = parseQuotePart(datum);

            let oldValue = this[datum.key];
            this[datum.key] = datum.value;
            this.emit("update", { key: datum.key, newValue: datum.value, oldValue: oldValue });
        }).on("error", err => {
            this.emit("error", err);
        }).on("end", () => {
            this.emit("load");
        }).send();
        
        return this;
    }
    
}

function parseQuotePart(datum) {
    let key = datum.name, value = datum.value;
    
    if (!key || key == "") throw new Error("Tick key not found.");
    if (value === null || value === "") throw new Error("No tick data value found.");
    if (key == "LAST_TIMESTAMP") value = new Date(parseInt(value) * 1000);
    if (key == "RT_VOLUME") {
        value = value.split(";");
        value = {
            price: parseFloat(value[0]),
            size: parseInt(value[1]),
            time: new Date(parseInt(value[2])),
            volume: parseInt(value[3]),
            vwap: parseFloat(value[4]),
            marketMaker: new Boolean(value[5])
        };
    }
    
    return { key: key.camelize(false), value: value };
}

module.exports = Quote;