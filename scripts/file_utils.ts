import { artifacts } from "hardhat";
import path = require("path");

export class FileUtils {

    public static saveFrontendFiles(address: string, contractName: string, label: string) {
        const fs = require("fs");
        const contractsDir = path.join(__dirname, "..", "frontend", "contracts");

        if (!fs.existsSync(contractsDir)) {
            fs.mkdirSync(contractsDir);
        }

        let rawdata = fs.readFileSync(path.join(contractsDir, "contract-address.json"));
        let addressData = JSON.parse(rawdata);
        addressData[label] = address;
        fs.writeFileSync(
            path.join(contractsDir, "contract-address.json"),
            JSON.stringify(addressData, undefined, 2)
        );

        const TokenArtifact = artifacts.readArtifactSync(contractName);

        fs.writeFileSync(
            path.join(contractsDir, label + ".json"),
            JSON.stringify(TokenArtifact, null, 2)
        );
    }

    public static getContractAddress(label: string) {
        const fs = require("fs");
        const contractsDir = path.join(__dirname, "..", "frontend", "contracts");
        let rawdata = fs.readFileSync(path.join(contractsDir, "contract-address.json"));
        let addressData = JSON.parse(rawdata);
        return addressData[label];
    }
}