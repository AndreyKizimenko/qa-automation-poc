// Prints a fresh Virtualization.framework machine identifier as base64.
// Usage: swift new-machine-id.swift mac|generic
// Apple-backend clones need a new one, or every clone reports the same
// hardware serial/UUID and Fleet merges them into one host.
import Foundation
import Virtualization

let kind = CommandLine.arguments.dropFirst().first ?? "mac"
let data: Data
switch kind {
case "mac": data = VZMacMachineIdentifier().dataRepresentation
case "generic": data = VZGenericMachineIdentifier().dataRepresentation
default:
    FileHandle.standardError.write("usage: new-machine-id.swift mac|generic\n".data(using: .utf8)!)
    exit(2)
}
print(data.base64EncodedString())
