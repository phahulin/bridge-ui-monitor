require('dotenv').config()
const needle = require('needle');
const path = require('path');
const fs = require('fs');

const BRIDGE_UI_URL = process.env.BRIDGE_UI_URL;
const HOME_BRIDGE_ADDRESS = process.env.HOME_BRIDGE_ADDRESS;
const FOREIGN_BRIDGE_ADDRESS = process.env.FOREIGN_BRIDGE_ADDRESS;

if (!BRIDGE_UI_URL || !HOME_BRIDGE_ADDRESS || !FOREIGN_BRIDGE_ADDRESS) {
    throw new Error('Expecting BRIDGE_UI_URL, HOME_BRIDGE_ADDRESS and FOREIGN_BRIDGE_ADDRESS env variables to be set');
}

// ********** DEBUG ********** //
if (process.env.DEBUG) {
    function log(...args) {
        console.log('******', new Date().toISOString(), ...args);
    }
}
else {
    function log() {}
}

// ********** TIMEOUT ********** //
console.log(new Date().toISOString(), 'STARTING SCRIPT');

const SCRIPT_TIMEOUT_SEC = 30;

setTimeout(function () {
    console.log(new Date().toISOString(), 'SCRIPT IS TAKING TOO LONG TO COMPLETE (>=' + SCRIPT_TIMEOUT_SEC + 's), EXITING');
    throw new Error('Script is taking too long to complete, SCRIPT_TIMEOUT_SEC = ' + SCRIPT_TIMEOUT_SEC);
}, SCRIPT_TIMEOUT_SEC*1000);

// ********** RESULT ********* //
const RESULT_FILE = path.join(__dirname, './result.json');

function writeResult(error) {
    var result = {};
    result.completedAt = new Date();
    if (error) {
        result.error = error;
        result.ok = false;
    }
    else {
        result.ok = true;
    }
    fs.writeFileSync(RESULT_FILE, JSON.stringify(result));
    process.exit(result.ok? 0:1);
}

// ********** FETCH MAIN PAGE ********** //
log('Making request to BRIDGE_UI_URL: ' + BRIDGE_UI_URL);
needle.get(BRIDGE_UI_URL, function (err, resp) {
    if (err) {
        return writeResult('main page: could not open url: ' + err);
    }

    if (resp.statusCode != 200) {
        return writeResult('main page: returned not-OK statusCode: ' + statusCode);
    }

    if (!resp.headers.server || resp.headers.server.trim().toLowerCase() != 'cloudflare') {
        return writeResult('main page: unexpected value of "Server" header - expecting "cloudflare", but got: ' + resp.headers.server);
    }

    var body1 = resp.body;
    log('main page response body:', body1);
    try {
        var scriptHash = body1.split('src="/static/js/main.')[1].split('"></script>')[0];
    }
    catch (ex) {
        return writeResult('main page: unexpected page structure - could not find link to react script: ' + ex);
    }

    var scriptURL = BRIDGE_UI_URL + '/static/js/main.' + scriptHash;

    log('Making request to scriptURL: ' + scriptURL);
    // ********** FETCH REACT SCRIPT ********** //
    return needle.get(scriptURL, function (err, resp) {
        if (err) {
            return writeResult('react script: could not open url: ' + err);
        }

        if (resp.statusCode != 200) {
            return writeResult('react script: url returned not-OK statusCode: ' + statusCode);
        }

        if (!resp.headers.server || resp.headers.server.trim().toLowerCase() != 'cloudflare') {
            return writeResult('react script: unexpected value of "Server" header - expecting "cloudflare", but got: ' + resp.headers.server);
        }

        var body2 = Buffer.from(resp.body).toString();
        log('react script response body: ', body2);

        // ********** GET ADDRESSES FROM SCRIPT ********** //
        try {
            var homeBridgeAddress = body2.split('this.HOME_BRIDGE_ADDRESS="')[1].split('"')[0];
        }
        catch (ex) {
            return writeResult('react script: unexpected page structure - could not find HOME_BRIDGE_ADDRESS assignment: ' + ex);
        }

        try {
            var foreignBridgeAddress = body2.split('this.FOREIGN_BRIDGE_ADDRESS="')[1].split('"')[0];
        }
        catch (ex) {
            return writeResult('react script: unexpected page structure - could not find FOREIGN_BRIDGE_ADDRESS assignment: ' + ex);
        }

        // ********** CHECK ADDRESSES ********** //
        if (homeBridgeAddress.toLowerCase() != HOME_BRIDGE_ADDRESS.toLowerCase()) {
            return writeResult('react script: incorrect HOME_BRIDGE_ADDRESS - expecting ' + HOME_BRIDGE_ADDRESS + ', but got: ' + homeBridgeAddress);
        }

        if (foreignBridgeAddress.toLowerCase() != FOREIGN_BRIDGE_ADDRESS.toLowerCase()) {
            return writeResult('react script: incorrect FOREIGN_BRIDGE_ADDRESS - expecting ' + FOREIGN_BRIDGE_ADDRESS + ', but got: ' + foreignBridgeAddress);
        }

        return writeResult();
    });
});
