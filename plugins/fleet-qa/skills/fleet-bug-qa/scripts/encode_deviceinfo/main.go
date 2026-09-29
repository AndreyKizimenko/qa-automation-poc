// Builds a self-signed (non-Apple) deviceinfo blob for driving Apple MDM enroll endpoints.
// The signature does not chain to Apple, so with mdm.apple_machineinfo_verify enforced (the default)
// the server rejects it at decode; it only passes in audit mode.
// It imports Fleet packages, so run it from inside the Fleet module:
//
//	mkdir -p <fleet checkout>/tools/qa-deviceinfo && cp <skill>/scripts/encode_deviceinfo/main.go $_
//	(cd <fleet checkout> && go run ./tools/qa-deviceinfo -serial C02XXXX)   # record "file" in the manifest
package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/fleetdm/fleet/v4/pkg/mdm/mdmtest"
	"github.com/fleetdm/fleet/v4/server/fleet"
)

func main() {
	serial := flag.String("serial", "", "hardware serial")
	product := flag.String("product", "Mac15,7", "product model id")
	os_ := flag.String("os", "14.4", "OS_VERSION")
	udid := flag.String("udid", "QA-TEST-UDID", "UDID")
	canUpdate := flag.Bool("canupdate", true, "MDM_CAN_REQUEST_SOFTWARE_UPDATE")
	updID := flag.String("updid", "J516sAP", "SOFTWARE_UPDATE_DEVICE_ID")
	flag.Parse()

	mi := fleet.MDMAppleMachineInfo{
		MDMCanRequestSoftwareUpdate: *canUpdate,
		Serial:                      *serial,
		UDID:                        *udid,
		Product:                     *product,
		OSVersion:                   *os_,
		SoftwareUpdateDeviceID:      *updID,
	}
	enc, err := mdmtest.EncodeDeviceInfo(mi)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Print(enc)
}
