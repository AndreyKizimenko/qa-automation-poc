# 7-Zip's NSIS installer takes /S for a silent install.
$p = Start-Process -FilePath $env:INSTALLER_PATH -ArgumentList "/S" -Wait -PassThru
exit $p.ExitCode
