---
tags: [behavior]
max_turns: 8
allowed_tools: [Skill, Read]
---

Load the fleet-qa:fleet-bug-qa skill. Do not run any commands; this is a dry exercise in what you hand over. The run for bug #53182 is finished. Fixed instance: rc-minor-fleet-v4.95.0. Pre-fix instance: rc-patch-fleet-v4.94.1. The rows, each of which reproduced on pre-fix where it should and passes on fixed: core 1, a host deleted in Google's console stays in Fleet (the issue's repro); core 2, the same through a work-profile removal on the device; core 3, the same for a host in No fleet; regression 4, a host that is still enrolled is left alone; regression 5, the hourly reconciler run still logs its activity; halo 6, the Hosts list count matches after the run. Rows 4-6 behave the same on both instances. One other thing turned up: a tooltip on the Policies page says 'recieve' instead of 'receive', on both instances. Write exactly what you would now send the engineer.
