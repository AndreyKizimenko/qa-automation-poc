# 7-Zip's uninstaller takes /S for a silent uninstall.
$p = Start-Process -FilePath "C:\Program Files\7-Zip\Uninstall.exe" -ArgumentList "/S" -Wait -PassThru
exit $p.ExitCode
