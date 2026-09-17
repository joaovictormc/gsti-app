// Coleta de hardware, sistema e saúde no Windows (somente leitura).
// Um único script PowerShell/CIM devolve JSON bruto; normalizar.js transforma no laudo.
// Itens que exigem administrador (SMART, temperatura) voltam vazios sem elevação.
const { execFile } = require("child_process");

const SCRIPT = String.raw`
$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"
function Lista($v) { if ($null -eq $v) { return @() } return @($v) }
$r = [ordered]@{}
$r.admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$r.computador = $env:COMPUTERNAME
$r.cpu = Lista (Get-CimInstance Win32_Processor | Select-Object Name, Manufacturer, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed)
$r.placa = Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer, Product, SerialNumber
$r.bios = Get-CimInstance Win32_BIOS | Select-Object Manufacturer, SMBIOSBIOSVersion, SerialNumber
$r.sistema = Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model, TotalPhysicalMemory, PCSystemType
$r.os = Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, OSArchitecture, @{n="InstallDate";e={$_.InstallDate.ToString("o")}}, @{n="LastBootUpTime";e={$_.LastBootUpTime.ToString("o")}}, FreePhysicalMemory, TotalVisibleMemorySize
$r.memoria = Lista (Get-CimInstance Win32_PhysicalMemory | Select-Object Capacity, Speed, ConfiguredClockSpeed, Manufacturer, PartNumber, DeviceLocator, SMBIOSMemoryType, FormFactor)
$r.slotsMemoria = (Get-CimInstance Win32_PhysicalMemoryArray | Measure-Object -Property MemoryDevices -Sum).Sum
$r.gpu = Lista (Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion, CurrentHorizontalResolution, CurrentVerticalResolution)
$r.discos = Lista (Get-PhysicalDisk | Select-Object DeviceId, FriendlyName, MediaType, BusType, Size, HealthStatus, OperationalStatus, SerialNumber)
$r.confiabilidade = Lista (Get-PhysicalDisk | ForEach-Object { $c = $_ | Get-StorageReliabilityCounter; if ($c) { [ordered]@{ DeviceId = $_.DeviceId; Temperature = $c.Temperature; TemperatureMax = $c.TemperatureMax; Wear = $c.Wear; PowerOnHours = $c.PowerOnHours; ReadErrorsTotal = $c.ReadErrorsTotal; ReadErrorsUncorrected = $c.ReadErrorsUncorrected; WriteErrorsTotal = $c.WriteErrorsTotal; WriteErrorsUncorrected = $c.WriteErrorsUncorrected; StartStopCycleCount = $c.StartStopCycleCount } } })
$r.volumes = Lista (Get-Volume | Where-Object { $_.DriveLetter -and $_.DriveType -eq "Fixed" } | Select-Object DriveLetter, FileSystemLabel, FileSystem, Size, SizeRemaining, HealthStatus)
$r.bitlocker = Lista (Get-CimInstance -Namespace root\cimv2\Security\MicrosoftVolumeEncryption -ClassName Win32_EncryptableVolume | Select-Object DriveLetter, ProtectionStatus)
$bat = Join-Path $env:TEMP ("gsti-bateria-" + [guid]::NewGuid().ToString() + ".xml")
powercfg /batteryreport /xml /output $bat | Out-Null
if (Test-Path $bat) {
  [xml]$x = Get-Content $bat -Raw
  $r.baterias = Lista ($x.BatteryReport.Batteries.Battery | Where-Object { $_ -and $_.Id } | ForEach-Object { [ordered]@{ Id = $_.Id; Manufacturer = $_.Manufacturer; Chemistry = $_.Chemistry; DesignCapacity = [long]$_.DesignCapacity; FullChargeCapacity = [long]$_.FullChargeCapacity; CycleCount = [long]$_.CycleCount } })
  Remove-Item $bat -Force
} else { $r.baterias = @() }
$r.cargaBateria = Lista (Get-CimInstance Win32_Battery | Select-Object EstimatedChargeRemaining, BatteryStatus)
$r.temperaturas = Lista (Get-CimInstance -Namespace root\wmi -ClassName MSAcpi_ThermalZoneTemperature | Select-Object InstanceName, CurrentTemperature)
$r.ativacao = Lista (Get-CimInstance SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL AND ApplicationID='55c92734-d682-4d71-983e-d6ec3f16059f'" | Select-Object Name, LicenseStatus)
$r.antivirus = Lista (Get-CimInstance -Namespace root\SecurityCenter2 -ClassName AntiVirusProduct | Select-Object displayName, productState)
$r.rede = Lista (Get-NetAdapter -Physical | Select-Object Name, InterfaceDescription, Status, LinkSpeed, MacAddress)
$r.ultimasFalhas = Lista (Get-WinEvent -FilterHashtable @{ LogName = "System"; Level = 1,2; StartTime = (Get-Date).AddDays(-7) } -MaxEvents 30 | Select-Object @{n="Data";e={$_.TimeCreated.ToString("o")}}, ProviderName, Id, @{n="Mensagem";e={ ($_.Message -split [Environment]::NewLine)[0] }})
$r.desligamentosInesperados = (Get-WinEvent -FilterHashtable @{ LogName = "System"; Id = 41; StartTime = (Get-Date).AddDays(-30) } | Measure-Object).Count
$r | ConvertTo-Json -Depth 5 -Compress
`;

function executarPowerShell(script, { timeout = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    // -EncodedCommand evita problemas de aspas e acentos (UTF-16LE em base64)
    const codificado = Buffer.from(`[Console]::OutputEncoding = [Text.Encoding]::UTF8\n${script}`, "utf16le").toString("base64");
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", codificado],
      { windowsHide: true, timeout, maxBuffer: 20 * 1024 * 1024, encoding: "utf8" },
      (erro, stdout, stderr) => {
        if (erro && !stdout) return reject(new Error(`PowerShell falhou: ${String(stderr || erro.message).slice(0, 300)}`));
        resolve(stdout);
      }
    );
  });
}

async function coletarBruto({ executar = executarPowerShell } = {}) {
  if (process.platform !== "win32" && executar === executarPowerShell) throw new Error("A coleta funciona apenas no Windows.");
  const saida = await executar(SCRIPT);
  const inicio = saida.indexOf("{");
  if (inicio < 0) throw new Error("A coleta não devolveu dados.");
  return JSON.parse(saida.slice(inicio));
}

module.exports = { SCRIPT, executarPowerShell, coletarBruto };
