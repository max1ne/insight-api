var Common = require('../lib/common');
var async = require('async');
var bitcore = require('bitcore-lib-zelcash');
var TYPE = 'BLOCKS_MINED';
var BN = bitcore.crypto.BN;

function AddressBlocksMinedService(options) {

    this.common = new Common({log: options.node.log});
    this.lastBlockRepository = options.lastBlockRepository;
    this.addressBlocksMinedRepository = options.addressBlocksMinedRepository;

    this.node = options.node;
    this.updateFromBlockHeight = 0;

    this.lastTipHeight = 0;
    this.lastTipInProcess = false;
    this.lastTipTimeout = false;
    this.lastCheckedBlock = 0;

}

/**
 *
 * @param {Function} next
 * @return {*}
 */
AddressBlocksMinedService.prototype.start = function (next) {

    var self = this;

    this.common.log.info('[AddressBlocksMinedService] Start...');

    return async.waterfall([function (callback) {
        return self.lastBlockRepository.setLastBlockType(TYPE, 0, function(err) {

            if (err) {

                self.common.log.error('[AddressBlocksMinedService] setLastBlockType Error', err);

                return callback(err)
            }

            self.common.log.info('[AddressBlocksMinedService] LastBlockType set');

            return callback();

        });
    }, function (callback) {
        return self.lastBlockRepository.getLastBlockByType(TYPE, function(err, existingType) {

            if (err) {

                self.common.log.error('[AddressBlocksMinedService] getLastBlockByType Error', err);

                return callback(err)
            }

            self.lastCheckedBlock = existingType.last_block_number;
            self.common.log.info('[AddressBlocksMinedService] getLastBlockByType set', self.lastCheckedBlock);
            return callback();

        })
    },function (callback) {
        return self.node.getInfo(function (err, data) {

            if (err) {

                self.common.log.error('[AddressBlocksMinedService] getInfo Error', err);

                return callback(err);
            }

            if (data && data.blocks > self.lastTipHeight) {
                self.lastTipHeight = data.blocks;
            }

            self.common.log.info('[AddressBlocksMinedService] lastTipHeight = ', self.lastTipHeight);

            return callback();
        });
    }, function (callback) {
        return self._updateCaches(function (err) {
            return callback(err);
        });
    }], function (err) {

        if (err) {
            self.common.log.error('[AddressBlocksMinedService] start Error', err);
            return next(err);
        }

        self._rapidProtectedUpdateTip(self.lastTipHeight);

        self.node.services.bitcoind.on('tip', self._rapidProtectedUpdateTip.bind(self));

        return next();

    });

};


AddressBlocksMinedService.prototype._updateCaches = function(next) {
    return next();
};

/**
 *
 * @param {number} height
 * @param {function} next
 * @return {*}
 * @private
 */
AddressBlocksMinedService.prototype._processLastBlocks = function(height, next) {

    var self = this,
        blocks = [];

    for (var i = self.lastCheckedBlock + 1; i <= height; i++) {
        blocks.push(i);
    }

    return async.eachSeries(blocks, function (blockHeight, callback) {
        return self.processBlock(blockHeight, function (err) {
            if (err) {
                return callback(err);
            }

            self.lastCheckedBlock = blockHeight;

            return callback();

        });
    }, function (err) {

        if (err) {
            self.common.log.error('[AddressBlocksMinedService] Update Error', err);
            return next(err);
        }

        return self._updateCaches(function (err) {
            return next(err);
        });

    });

};

/**
 *
 * @param {Number} height
 * @private
 */
AddressBlocksMinedService.prototype._rapidProtectedUpdateTip = function(height) {

    var self = this;

    if (height > this.lastTipHeight) {
        this.lastTipHeight = height;
    }


    if (this.lastTipInProcess) {
        return false;
    }

    this.lastTipInProcess = true;

    self.common.log.info('[AddressBlocksMinedService] start upd from ', self.lastCheckedBlock + 1 , ' to ', height);

    return this._processLastBlocks(height, function (err) {

        self.lastTipInProcess = false;

        if (err) {
            return false;
        }

        self.common.log.info('[AddressBlocksMinedService] updated to ', height);

        if (self.lastTipHeight !== height) {
            self._rapidProtectedUpdateTip(self.lastTipHeight);
        }

    });

};

/**
 *
 * @param {Number} blockHeight
 * @param {Function} next
 * @return {*}
 */
AddressBlocksMinedService.prototype.processBlock = function (blockHeight, next) {

    var self = this;
    var block;
    var transaction;


    return async.waterfall([function (callback) {
        return self.node.services.bitcoind.getJsonBlock(blockHeight, function (err, response) {

            if (err) {
                return callback(err);
            }

            if (!response) {
                return callback('Error getBlock');
            }

            block = response;

            return callback();

        });
    }, function (callback) {

        var txHash;

        txHash = block.tx[0];

        return self.node.getDetailedTransaction(txHash, function (err, trx) {

            if (err) {
                return callback(err);
            }

            transaction = trx;

            return callback();

        });

    }, function (callback) {

        var minedBy;
        var abmspoolAddress;
        var abmsreward = self.getBlockReward(block.height);

        transaction.outputs.forEach(function (output) {
            if (output.satoshis > (abmsreward * 0.6)) {
                abmspoolAddress = output.address;
            }
        });

        minedBy = abmspoolAddress

        if (!minedBy) {
            return callback();
        }

        return self.addressBlocksMinedRepository.createOrUpdateAddress({address: minedBy}, function (err) {
            return callback(err);
        });

    }], function (err) {

        if (err) {
            return next(err);
        }

        return self.lastBlockRepository.updateOrAddLastBlock(block.height, TYPE, function (err) {
            return next(err);
        });

    });

};

AddressBlocksMinedService.prototype.getBlockReward = function(height) {
    var subsidy;
    if (height == 0) {
      subsidy = new BN(0);
    } else if (height == 1) {
      subsidy = new BN(4000000);
    } else if (height == 80185) {
      subsidy = new BN(665600);
    } else if (height < 123840) {
      subsidy = new BN(128);
    } else if (height < 178378) {
      subsidy = new BN(64);
    } else if (height < 181378) {
      subsidy = new BN(56);
    } else if (height < 184376) {
      subsidy = new BN(48);
    } else if (height < 187378) {
      subsidy = new BN(40);
    } else if (height < 197378) {
      subsidy = new BN(32);
    } else if (height < 207378) {
      subsidy = new BN(28);
    } else if (height < 217378) {
      subsidy = new BN(24);
    } else if (height < 227378) {
      subsidy = new BN(22);
    } else if (height < 237378) {
      subsidy = new BN(20);
    } else if (height < 247378) {
      subsidy = new BN(18);
    } else if (height < 287378) {
      subsidy = new BN(16);
    } else if (height < 327378) {
      subsidy = new BN(15);
    } else if (height < 367378) {
      subsidy = new BN(14);
    } else if (height < 407378) {
      subsidy = new BN(13);
    } else if (height < 447378) {
      subsidy = new BN(12);
    } else if (height < 487378) {
      subsidy = new BN(11);
    } else if (height < 527378) {
      subsidy = new BN(10);
    } else if (height < 557378) {
      subsidy = new BN(5);
    } else if (height < 1207378) {
      subsidy = new BN(4);
    } else if (height < 1707378) {
      subsidy = new BN(3);
    } else if (height < 2207378) {
      subsidy = new BN(2);
    } else if (height < 2707378) {
      subsidy = new BN(1);
    } else if (height < 3707378) {
      subsidy = new BN(0.5);
    } else if (height < 4707378) {
      subsidy = new BN(0.25);
    } else if (height < 5707378) {
      subsidy = new BN(0.125);
    } else {
      subsidy = new BN(0);
    }

  return parseInt(subsidy.toString(10));
};

module.exports = AddressBlocksMinedService;
