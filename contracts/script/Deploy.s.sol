// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ImpactAnchorRegistry} from "../src/ImpactAnchorRegistry.sol";

/// Deploys the registry. The broadcasting account becomes the owner and, unless ANCHORER_ADDRESS
/// names another account, the anchorer. The key is passed on the command line by the maintainer
/// and never appears in this repository (docs/09-WEB3.md §6):
///
///   cd contracts
///   forge script script/Deploy.s.sol --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast --private-key "<the anchor key>"
///
/// then verify the source on BaseScan, so the public can read what the address runs:
///
///   forge verify-contract <address> src/ImpactAnchorRegistry.sol:ImpactAnchorRegistry --chain base-sepolia \
///     --constructor-args $(cast abi-encode "constructor(address)" <owner>) --etherscan-api-key "<key>"
contract Deploy is Script {
    function run() external returns (ImpactAnchorRegistry registry) {
        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        address anchorer = vm.envOr("ANCHORER_ADDRESS", deployer);
        registry = new ImpactAnchorRegistry(deployer);
        registry.setAnchorer(anchorer, true);
        vm.stopBroadcast();

        console2.log("ImpactAnchorRegistry:", address(registry));
        console2.log("owner:", deployer);
        console2.log("anchorer:", anchorer);
    }
}
