'use strict';

var Common = require('./common');

function StatusController(node) {
  this.node = node;
  this.common = new Common({ log: this.node.log });
}

StatusController.prototype.show = function (req, res) {
  var self = this;
  var option = req.query.q;

  switch (option) {
    case 'getDifficulty':
      this.getDifficulty(function (err, result) {
        if (err) {
          return self.common.handleErrors(err, res);
        }
        res.jsonp(result);
      });
      break;
    case 'getLastBlockHash':
      res.jsonp(this.getLastBlockHash());
      break;
    case 'getBestBlockHash':
      this.getBestBlockHash(function (err, result) {
        if (err) {
          return self.common.handleErrors(err, res);
        }
        res.jsonp(result);
      });
      break;
    case 'getMiningInfo':
      this.getMiningInfo(function (err, result) {
        if (err) {
          return self.common.handleErrors(err, res);
        }
        res.jsonp({
          miningInfo: result
        });
      });
      break
    case 'getPeerInfo':
      this.getPeerInfo(function (err, result) {
        if (err) {
          return self.common.handleErrors(err, res);
        }
        res.jsonp({
          peerInfo: result
        });
      });
      break;
    case 'getInfo':
    default:
      this.getInfo(function (err, result) {
        if (err) {
          return self.common.handleErrors(err, res);
        }
        res.jsonp({
          info: result
        });
      });
  }
};

StatusController.prototype.getInfo = function (callback) {
  this.node.services.bitcoind.getInfo(function (err, result) {
    if (err) {
      return callback(err);
    }
    var info = {
      version: result.version,
      protocolversion: result.protocolVersion,
      walletversion: result.walletversion,
      blocks: result.blocks,
      timeoffset: result.timeOffset,
      connections: result.connections,
      proxy: result.proxy,
      difficulty: result.difficulty,
      testnet: result.testnet,
      relayfee: result.relayFee,
      errors: result.errors,
      network: result.network,
      reward: result.reward
    };
    callback(null, info);
  });
};

StatusController.prototype.getMiningInfo = function (callback) {
  this.node.services.bitcoind.getMiningInfo(function (err, result) {
    if (err) {
      return callback(err);
    }
    var miningInfo = {
      difficulty: result.difficulty,
      networkhashps: result.networkhashps
    };
    callback(null, miningInfo);
  });
};

StatusController.prototype.getPeerInfo = function (callback) {
  this.node.services.bitcoind.getPeerInfo(function (err, response) {
    if (err) {
      return callback(err);
    }
    var peers = [];
    var date_now = new Date();
    response.result.forEach(function (obj) {

      var date_past = new Date(obj.conntime * 1000);
      var seconds = Math.floor((date_now - (date_past)) / 1000);
      var minutes = Math.floor(seconds / 60);
      var hours = Math.floor(minutes / 60);
      var days = Math.floor(hours / 24);

      hours = hours - (days * 24);
      minutes = minutes - (days * 24 * 60) - (hours * 60);
      seconds = seconds - (days * 24 * 60 * 60) - (hours * 60 * 60) - (minutes * 60);

      //check ipv6
      var actualaddress = null
      if (obj.addr.charAt(0) === '[') {
        obj.addr = obj.addr.substr(1);
        actualaddress = obj.addr.split(']')[0]
      } else {
        actualaddress = obj.addr.split(':')[0]
      }

      peers.push({
        address: actualaddress,
        protocol: obj.version,
        version: obj.subver.replace('/', '').replace('/', ''),
        uptime: {
          Days: days,
          Hours: hours,
          Minutes: minutes,
          Seconds: seconds,
        },
        timestamp: obj.conntime
      });
    });
    peers.sort(function (a, b) {
      return a.timestamp - b.timestamp;
    });
    callback(null, peers);
  });
};

StatusController.prototype.getLastBlockHash = function () {
  var hash = this.node.services.bitcoind.tiphash;
  return {
    syncTipHash: hash,
    lastblockhash: hash
  };
};

StatusController.prototype.getBestBlockHash = function (callback) {
  this.node.services.bitcoind.getBestBlockHash(function (err, hash) {
    if (err) {
      return callback(err);
    }
    callback(null, {
      bestblockhash: hash
    });
  });
};

StatusController.prototype.getDifficulty = function (callback) {
  this.node.services.bitcoind.getInfo(function (err, info) {
    if (err) {
      return callback(err);
    }
    callback(null, {
      difficulty: info.difficulty
    });
  });
};

StatusController.prototype.sync = function (req, res) {
  var self = this;
  var status = 'syncing';

  this.node.services.bitcoind.isSynced(function (err, synced) {
    if (err) {
      return self.common.handleErrors(err, res);
    }
    if (synced) {
      status = 'finished';
    }

    self.node.services.bitcoind.syncPercentage(function (err, percentage) {
      if (err) {
        return self.common.handleErrors(err, res);
      }
      var info = {
        status: status,
        blockChainHeight: self.node.services.bitcoind.height,
        syncPercentage: Math.round(percentage),
        height: self.node.services.bitcoind.height,
        error: null,
        type: 'bitcore node'
      };

      res.jsonp(info);

    });

  });

};

// Hard coded to make insight ui happy, but not applicable
StatusController.prototype.peer = function (req, res) {
  res.jsonp({
    connected: true,
    host: '127.0.0.1',
    port: null
  });
};

StatusController.prototype.version = function (req, res) {
  var pjson = require('../package.json');
  res.jsonp({
    version: pjson.version
  });
};

StatusController.prototype.circulation = function (req, res) {
  var self = this;
  var subsidy;
  var coins;
  if (self.node.services.bitcoind.height == 0) {
    subsidy = 0;
    coins = 0
  } else if (self.node.services.bitcoind.height == 1) {
    subsidy = 4000000;
    coins = 4000000;
  } else if (self.node.services.bitcoind.height == 80185) {
    subsidy = 665600;
    coins = 4000000 + 80184 * 128 + 665600
  } else if (self.node.services.bitcoind.height < 123840) {
    subsidy = 128;
    coins = 4000000 + 665600 + self.node.services.bitcoind.height * 128;
  } else if (self.node.services.bitcoind.height < 178378) {
    subsidy = 64;
    coins = 4000000 + 665600 + 123840 * 128 + (self.node.services.bitcoind.height - 123840) * 64;
  } else if (self.node.services.bitcoind.height < 181378) {
    subsidy = 56;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 +  (self.node.services.bitcoind.height - 181378) * 56;
  } else if (self.node.services.bitcoind.height < 184376) {
    subsidy = 48;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 +  (self.node.services.bitcoind.height - 184376) * 48;
  } else if (self.node.services.bitcoind.height < 187378) {
    subsidy = 40;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 +  (self.node.services.bitcoind.height - 187378) * 40;
  } else if (self.node.services.bitcoind.height < 197378) {
    subsidy = 32;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 +  (self.node.services.bitcoind.height - 197378) * 32;
  } else if (self.node.services.bitcoind.height < 207378) {
    subsidy = 28;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 +  (self.node.services.bitcoind.height - 207378) * 28;
  } else if (self.node.services.bitcoind.height < 217378) {
    subsidy = 24;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 +  (self.node.services.bitcoind.height - 217378) * 24;
  } else if (self.node.services.bitcoind.height < 227378) {
    subsidy = 22;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (self.node.services.bitcoind.height - 227378) * 22;
  } else if (self.node.services.bitcoind.height < 237378) {
    subsidy = 20;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (self.node.services.bitcoind.height - 237378) * 20;
  } else if (self.node.services.bitcoind.height < 247378) {
    subsidy = 18;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (self.node.services.bitcoind.height - 247378) * 18;
  } else if (self.node.services.bitcoind.height < 287378) {
    subsidy = 16;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (self.node.services.bitcoind.height - 287378) * 16;
  } else if (self.node.services.bitcoind.height < 327378) {
    subsidy = 15;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (287378 - 247378) * 16 + (self.node.services.bitcoind.height - 327378) * 15;
  } else if (self.node.services.bitcoind.height < 367378) {
    subsidy = 14;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (287378 - 247378) * 16 + (327378 - 287378) * 15 + (self.node.services.bitcoind.height - 367378) * 14;
  } else if (self.node.services.bitcoind.height < 407378) {
    subsidy = 13;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (287378 - 247378) * 16 + (327378 - 287378) * 15 + (367378 - 327378) * 14 + (self.node.services.bitcoind.height - 407378) * 13;
  } else if (self.node.services.bitcoind.height < 447378) {
    subsidy = 12;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (287378 - 247378) * 16 + (327378 - 287378) * 15 + (367378 - 327378) * 14 + (407378 - 367378) * 13 + (self.node.services.bitcoind.height - 447378) * 12;
  } else if (self.node.services.bitcoind.height < 487378) {
    subsidy = 11;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (287378 - 247378) * 16 + (327378 - 287378) * 15 + (367378 - 327378) * 14 + (407378 - 367378) * 13 + (447378 - 407378) * 12 + (self.node.services.bitcoind.height - 487378) * 11;
  } else if (self.node.services.bitcoind.height < 527378) {
    subsidy = 10;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (287378 - 247378) * 16 + (327378 - 287378) * 15 + (367378 - 327378) * 14 + (407378 - 367378) * 13 + (447378 - 407378) * 12 + (487378 - 447378) * 11 + (self.node.services.bitcoind.height - 527378) * 10;
  } else if (self.node.services.bitcoind.height < 557378) {
    subsidy = 5;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (287378 - 247378) * 16 + (327378 - 287378) * 15 + (367378 - 327378) * 14 + (407378 - 367378) * 13 + (447378 - 407378) * 12 + (487378 - 447378) * 11 + (527378 - 487378) * 10 + (self.node.services.bitcoind.height - 557378) * 5;
  } else if (self.node.services.bitcoind.height < 1207378) {
    subsidy = 4
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (287378 - 247378) * 16 + (327378 - 287378) * 15 + (367378 - 327378) * 14 + (407378 - 367378) * 13 + (447378 - 407378) * 12 + (487378 - 447378) * 11 + (527378 - 487378) * 10 + (557378 - 527378) * 5 + (self.node.services.bitcoind.height - 1207378) * 4;
  } else if (self.node.services.bitcoind.height < 1707378) {
    subsidy = 3;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (287378 - 247378) * 16 + (327378 - 287378) * 15 + (367378 - 327378) * 14 + (407378 - 367378) * 13 + (447378 - 407378) * 12 + (487378 - 447378) * 11 + (527378 - 487378) * 10 + (557378 - 527378) * 5 + (1207378 - 557378) * 4 + (self.node.services.bitcoind.height - 1707378) * 3;
  } else if (self.node.services.bitcoind.height < 2207378) {
    subsidy = 2;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (287378 - 247378) * 16 + (327378 - 287378) * 15 + (367378 - 327378) * 14 + (407378 - 367378) * 13 + (447378 - 407378) * 12 + (487378 - 447378) * 11 + (527378 - 487378) * 10 + (557378 - 527378) * 5 + (1207378 - 557378) * 4 + (1707378 - 1207378) * 3 + (self.node.services.bitcoind.height - 2207378) * 2;
  } else if (self.node.services.bitcoind.height < 2707378) {
    subsidy = 1;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (287378 - 247378) * 16 + (327378 - 287378) * 15 + (367378 - 327378) * 14 + (407378 - 367378) * 13 + (447378 - 407378) * 12 + (487378 - 447378) * 11 + (527378 - 487378) * 10 + (557378 - 527378) * 5 + (1207378 - 557378) * 4 + (1707378 - 1207378) * 3 + (2207378 - 1707378) * 2 + (self.node.services.bitcoind.height - 2707378) * 1;
  } else if (self.node.services.bitcoind.height < 3707378) {
    subsidy = 0.5;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (287378 - 247378) * 16 + (327378 - 287378) * 15 + (367378 - 327378) * 14 + (407378 - 367378) * 13 + (447378 - 407378) * 12 + (487378 - 447378) * 11 + (527378 - 487378) * 10 + (557378 - 527378) * 5 + (1207378 - 557378) * 4 + (1707378 - 1207378) * 3 + (2207378 - 1707378) * 2 + (2707378 - 2207378) * 1 + (self.node.services.bitcoind.height - 3707378) * 0.5;
  } else if (self.node.services.bitcoind.height < 4707378) {
    subsidy = 0.25;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (287378 - 247378) * 16 + (327378 - 287378) * 15 + (367378 - 327378) * 14 + (407378 - 367378) * 13 + (447378 - 407378) * 12 + (487378 - 447378) * 11 + (527378 - 487378) * 10 + (557378 - 527378) * 5 + (1207378 - 557378) * 4 + (1707378 - 1207378) * 3 + (2207378 - 1707378) * 2 + (2707378 - 2207378) * 1 + (3707378 - 2707378) * 0.5 + (self.node.services.bitcoind.height - 4707378) * 0.25;
  } else if (self.node.services.bitcoind.height < 5707378) {
    subsidy = 0.125;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (287378 - 247378) * 16 + (327378 - 287378) * 15 + (367378 - 327378) * 14 + (407378 - 367378) * 13 + (447378 - 407378) * 12 + (487378 - 447378) * 11 + (527378 - 487378) * 10 + (557378 - 527378) * 5 + (1207378 - 557378) * 4 + (1707378 - 1207378) * 3 + (2207378 - 1707378) * 2 + (2707378 - 2207378) * 1 + (3707378 - 2707378) * 0.5 + (4707378 - 3707378) * 0.25 + (self.node.services.bitcoind.height - 5707378) * 0.125;
  } else {
    subsidy = 0;
    coins = 4000000 + 665600 + 123840 * 128 + (178378 - 123840) * 64 + (181378 - 178378) * 56 + (184376 - 181378) * 48 + (187378 - 184376) * 40 + (197378 - 187378) * 32 + (207378 - 197378) * 28 + (217378 - 207378) * 24 + (227378 - 217378) * 22 + (237378 - 227378) * 20 + (247378 - 237378) * 18 + (287378 - 247378) * 16 + (327378 - 287378) * 15 + (367378 - 327378) * 14 + (407378 - 367378) * 13 + (447378 - 407378) * 12 + (487378 - 447378) * 11 + (527378 - 487378) * 10 + (557378 - 527378) * 5 + (1207378 - 557378) * 4 + (1707378 - 1207378) * 3 + (2207378 - 1707378) * 2 + (2707378 - 2207378) * 1 + (3707378 - 2707378) * 0.5 + (4707378 - 3707378) * 0.25 + (5707378 - 4707378) * 0.125;
  }

  res.jsonp({
    circulationsupply: coins,
    circsupplyint: Math.round(coins),
    circsupplydig: coins.toFixed(8)
  });
};

module.exports = StatusController;
