const os = require('node:os');
const { execFileSync } = require('node:child_process');

function powershellJson(script) {
  try {
    const raw = execFileSync('powershell.exe', ['-NoProfile','-NonInteractive','-Command', script], {
      encoding:'utf8', windowsHide:true, timeout:8000, maxBuffer:1024*1024
    }).trim();
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function sampleHardware() {
  const total = os.totalmem(), free = os.freemem();
  const memoryPct = total ? ((total - free) / total) * 100 : null;
  const disk = powershellJson("$d=Get-PSDrive -Name C; @{free=[double]$d.Free;used=[double]$d.Used}|ConvertTo-Json -Compress");
  const cpu = powershellJson("$x=(Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -Filter \"Name='_Total'\").PercentProcessorTime; @{cpu=[double]$x}|ConvertTo-Json -Compress");
  const thermal = powershellJson("$t=Get-CimInstance -Namespace root/wmi -Class MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue|Select-Object -Expand CurrentTemperature; @{raw=@($t)}|ConvertTo-Json -Compress");
  const tempsC = Array.isArray(thermal?.raw) ? thermal.raw.map(v => Number(v)/10-273.15).filter(v => Number.isFinite(v) && v>-20 && v<150) : [];
  return { at:new Date().toISOString(), memoryPct, freeMemoryBytes:free,
    cpuPct:Number.isFinite(Number(cpu?.cpu))?Number(cpu.cpu):null,
    diskFreeBytes:Number.isFinite(Number(disk?.free))?Number(disk.free):null,
    temperaturesC:tempsC, thermalTelemetryAvailable:tempsC.length>0 };
}
function evaluateHardware(sample, limits = {}) {
  const cfg = {
    memoryPausePct:Number(limits.memoryPausePct)||88,
    memoryStopPct:Number(limits.memoryStopPct)||94,
    cpuPausePct:Number(limits.cpuPausePct)||90,
    diskMinFreeBytes:Number(limits.diskMinFreeBytes)||20*1024*1024*1024,
    tempPauseC:Number(limits.tempPauseC)||85,
    tempStopC:Number(limits.tempStopC)||95
  };
  const reasons=[]; let severity='OK';
  const elevate = level => { if (level==='STOP' || (level==='PAUSE' && severity==='OK')) severity=level; };
  if (sample.memoryPct >= cfg.memoryStopPct) { reasons.push('MEMORY_HARD_STOP'); elevate('STOP'); }
  else if (sample.memoryPct >= cfg.memoryPausePct) { reasons.push('MEMORY_PRESSURE'); elevate('PAUSE'); }
  if (sample.cpuPct != null && sample.cpuPct >= cfg.cpuPausePct) { reasons.push('CPU_PRESSURE'); elevate('PAUSE'); }
  if (sample.diskFreeBytes != null && sample.diskFreeBytes < cfg.diskMinFreeBytes) { reasons.push('LOW_DISK'); elevate('STOP'); }
  const maxTemp = sample.temperaturesC.length ? Math.max(...sample.temperaturesC) : null;
  if (maxTemp != null && maxTemp >= cfg.tempStopC) { reasons.push('THERMAL_HARD_STOP'); elevate('STOP'); }
  else if (maxTemp != null && maxTemp >= cfg.tempPauseC) { reasons.push('THERMAL_PRESSURE'); elevate('PAUSE'); }
  return { severity, reasons, limits:cfg, maxTempC:maxTemp,
    heavyWorkPermitted:severity==='OK', sampledAt:sample.at,
    note:sample.thermalTelemetryAvailable?'THERMAL_SENSOR_REPORTED':'THERMAL_SENSOR_UNAVAILABLE_CONSERVATIVE_RESOURCE_GUARDS_ACTIVE' };
}

module.exports = { sampleHardware, evaluateHardware };
