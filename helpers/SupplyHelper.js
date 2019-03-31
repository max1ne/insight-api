var BigNumber = require('bignumber.js');

module.exports = {
    /**
     *
     * @param {Number} height
     * @return {BigNumber}
     */
    getTotalSupplyByHeight: function (height) {
        return (new BigNumber(0)).plus((height) * 12500)
    }

};
