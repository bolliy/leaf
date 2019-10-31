"use strict";

const expect = require("chai").expect;
const fs = require("fs");
const Config = require("./index.js");

const configPath = "./test-config.json";
const defaults = {
    "foo": "bar",
    "john": "doe"
};
const configContents = {
    "foo": "baz",
    "hello": "world"
};

beforeEach(function(done) {
    fs.writeFile(configPath, JSON.stringify(configContents), done);
});

after(function(done) {
    fs.unlink(configPath, done);
});

describe("construct:", function() {
    it("should import defaults", function () {
        let config = new Config("", {"defaults": defaults});
        expect(config.get()).to.deep.equal(defaults);
    });

    it("should import config.json", function () {
        let config = new Config(configPath);
        expect(config.get()).to.deep.equal(configContents);
    });

    it("should merge config.json with defaults", function () {
        let config = new Config(configPath, {"defaults": defaults});
        expect(config.get()).to.deep.equal({
            "foo": "baz",
            "hello": "world",
            "john": "doe"
        });
    });

    it("should throw an error when config.json is not found", function(done) {
        new Config("path/to/missing/config", {}, function(err) {
            expect(err).to.be.an("error");
            done();
        });
    });
});

describe("get() and set():", function() {
    let config;

    beforeEach(function() {
        config = new Config("", {
            "defaults": {
                "foo": "bar",
                "nested": {
                    "object": true
                }
            }
        });
    });

    it("should get values", function () {
        expect(config.get("foo")).to.equal("bar");
        expect(config.get("nested:object")).to.equal(true);
    });

    it("should set values", function () {
        config.set("foo", "baz");
        config.set("hello", "world");
        config.set("nested:object", false);
        expect(config.get("foo")).to.equal("baz");
        expect(config.get("nested:object")).to.equal(false);
    });
});

describe("save and watch:", function() {
    let config;

    beforeEach(function() {
        config = new Config(configPath);
    });

    it("should save changes to config.json", function (done) {
        config.set("hello", "john");
        config.save(function (err) {
            fs.readFile(configPath, function (err, data) {
                if (err) throw err;
                let newConfig = JSON.parse(data.toString());
                expect(newConfig.hello).to.equal("john");
                done();
            });
        });
    });

    it("should watch for changes in config.json", function (done) {
        config.once("change", done);
        fs.writeFile(configPath, '{ "goodbye": "world" }');
    });

    it("should find that foo has changed", function (done) {
        config.once("change", (err, config) => {
            if (config.hasChanged("foo")) done();
        });
        fs.writeFile(configPath, '{ "foo": "changed" }');
    });

    it("should cancel change on foo", function (done) {
        config.once("change", (err, config) => {
            config.cancelChange("foo");
            if (!config.hasChanged("foo")) done();
        });
        fs.writeFile(configPath, '{ "foo": "changed" }');
    });

    it("should cancel change on the whole config", function (done) {
        config.once("change", (err, config) => {
            config.cancelChange();
            if (!config.hasChanged("foo")) done();
        });
        fs.writeFile(configPath, '{ "foo": "changed" }');
    });
});
