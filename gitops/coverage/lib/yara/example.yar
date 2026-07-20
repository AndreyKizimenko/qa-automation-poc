rule FleetCoverageExampleRule
{
  meta:
    description = "Coverage fixture YARA rule (matches a benign marker string)."
    author = "qa-automation gitops coverage"
  strings:
    $marker = "fleet-coverage-yara-marker"
  condition:
    $marker
}
