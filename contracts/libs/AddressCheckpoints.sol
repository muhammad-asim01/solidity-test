// SPDX-License-Identifier: MIT
// This is a modification of OpenZeppelin Checkpoints.sol to support custom struct
pragma solidity ^0.8.20;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

library AddressCheckpoints {
    error CheckpointUnorderedInsertion();

    struct Trace {
        Checkpoint[] _checkpoints;
    }

    struct Checkpoint {
        uint48 _key;
        address _value;
    }

    function push(Trace storage self, uint48 key, address value) internal {
        return _insert(self._checkpoints, key, value);
    }

    function _insert(
        Checkpoint[] storage self,
        uint48 key,
        address value
    ) private {
        uint256 pos = self.length;

        if (pos > 0) {
            Checkpoint memory last = self[pos - 1];

            if (last._key > key) {
                revert CheckpointUnorderedInsertion();
            }

            if (last._key == key) {
                self[pos - 1]._value = value;
            } else {
                self.push(Checkpoint({_key: key, _value: value}));
            }
        } else {
            self.push(Checkpoint({_key: key, _value: value}));
        }
    }

    function latest(Trace storage self) internal view returns (address) {
        uint256 pos = self._checkpoints.length;
        return pos == 0 ? address(0) : self._checkpoints[pos - 1]._value;
    }

    function upperLookupRecent(
        Trace storage self,
        uint48 key
    ) internal view returns (address) {
        uint256 len = self._checkpoints.length;

        uint256 low = 0;
        uint256 high = len;

        if (len > 5) {
            uint256 mid = len - Math.sqrt(len);
            if (key < self._checkpoints[mid]._key) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        uint256 pos = _upperBinaryLookup(self._checkpoints, key, low, high);

        return pos == 0 ? address(0) : self._checkpoints[pos - 1]._value;
    }

    function _upperBinaryLookup(
        Checkpoint[] storage self,
        uint48 key,
        uint256 low,
        uint256 high
    ) private view returns (uint256) {
        while (low < high) {
            uint256 mid = Math.average(low, high);
            if (self[mid]._key > key) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return high;
    }
}
