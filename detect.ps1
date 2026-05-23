# Ventoy Manager — Hardened Telemetry Discovery (v7.5)
# Ensures zero data loss during the Electron bridge transfer.

$removableDisks = Get-Disk | Where-Object { $_.Number -gt 0 -or ($_.BusType -eq "USB") }

$results = foreach ($disk in $removableDisks) {
    try {
        $diskPartitions = Get-Partition -DiskNumber $disk.Number -ErrorAction SilentlyContinue
        $mainPart = $diskPartitions | Where-Object { $_.DriveLetter -and $_.DriveLetter -ne 'C' } | Select-Object -First 1
        
        $partitionList = @()
        $hasVentoyMarker = $false

        foreach ($p in $diskPartitions) {
            $v = $p | Get-Volume -ErrorAction SilentlyContinue
            $label = if ($v) { $v.FileSystemLabel } else { "" }
            
            # Definitive Boot Signature
            $isBoot = [bool]($label -eq "VTOYEFI" -or ($p.Size -ge 30MB -and $p.Size -le 34MB))
            if ($isBoot) { $hasVentoyMarker = $true }

            $partitionList += @{
                number = $p.PartitionNumber
                label = if ($label) { $label } else { "Primary Storage" }
                free_bytes = if ($v) { $v.SizeRemaining } else { 0 }
                total_bytes = $p.Size
                is_boot = $isBoot
            }
        }

        if ($mainPart) {
            $vol = Get-Volume -DriveLetter $mainPart.DriveLetter -ErrorAction SilentlyContinue
            
            # Final Ventoy Check
            if (!$hasVentoyMarker) {
                if (Test-Path "$($mainPart.DriveLetter):\ventoy") { $hasVentoyMarker = $true }
            }

            @{
                path = "$($mainPart.DriveLetter):\"
                label = if ($vol.FileSystemLabel) { $vol.FileSystemLabel } else { "USB Drive" }
                is_ventoy = $hasVentoyMarker
                partitions = $partitionList
            }
        }
    } catch { }
}

if ($results) {
    ,@($results) | ConvertTo-Json -Compress -Depth 5
} else {
    echo "[]"
}
