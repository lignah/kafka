/* 1. retrieve windows event log
 * 2. write to log file
 * 3. detect realtime event
 * 4. write to log file           */

const fs = require('fs');
const { spawn } = require('child_process');

const logFileName = 'temp.log';

let eventLogArray = [];

const initialPsCommand = `
$StartTime = Get-Date -Hour 0 -Minute 0 -Second 0;

# get event happened after 00:00 today
Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=$StartTime} |
    ForEach-Object {
        [PSCustomObject]@{
            TimeCreated = $_.TimeCreated.ToString("yyyy-MM-dd HH:mm:ss")
            Id = $_.Id
            LevelDisplayName = $_.LevelDisplayName
            Message = $_.Message
        }
    } | Sort-Object TimeCreated | ConvertTo-Json -Depth 10;
`;

const monitoringPsCommand = `
$OutputEncoding = [System.Text.Encoding]::UTF8;
$StartTime = Get-Date

# realtime monitoring
while ($true) {
    $Events = Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=$StartTime} -ErrorAction SilentlyContinue |
        ForEach-Object {
            [PSCustomObject]@{
                TimeCreated = $_.TimeCreated.ToString("yyyy-MM-dd HH:mm:ss")
                Id = $_.Id
                LevelDisplayName = $_.LevelDisplayName
                Message = $_.Message
            }
        };

    if ($Events) {
        $Events | ConvertTo-Json -Depth 10 -Compress | Write-Output;
        $StartTime = Get-Date;
    }
    Start-Sleep -Seconds 2;
}`;

const pwsh = spawn('powershell.exe', ['-NoProfile', '-Command', initialPsCommand]);

let buffer = '';

// keep accumulating event in the buffer
pwsh.stdout.on('data', (data) => {
    buffer += data.toString();
});

// stderr is for error handling
pwsh.stderr.on('data', (data) => {
    console.error(`powershell error (initial log): ${data}`);
});

// run when powershell script end
pwsh.on('close', () => {
    try {
        if (buffer.trim()) {
            const events = JSON.parse(buffer.trim());
            const formattedEvents = Array.isArray(events) ? events : [events];

            eventLogArray = eventLogArray.concat(formattedEvents);
            // TimeCreated : key in json object output by powershell
            eventLogArray.sort((a, b) => new Date(a.TimeCreated) - new Date(b.TimeCreated));

            // add event without overwriting them
            for (const event of formattedEvents) {
                fs.appendFileSync(logFileName, JSON.stringify(event, null, 4) + ',\n', 'utf8');
            }

            console.log('initial events collected and logged.');
        }

        console.log('start monitoring event...');
        const realtimePs = spawn('pwsh', ['-NoProfile', '-Command', monitoringPsCommand]);

        realtimePs.stdout.setEncoding('utf8');
        realtimePs.stdout.on('data', (data) => {
            try {
                const output = data.trim();
                if (!output) return;

                const events = JSON.parse(output);
                const formattedEvents = Array.isArray(events) ? events : [events];

                eventLogArray = eventLogArray.concat(formattedEvents);
                eventLogArray.sort((a, b) => new Date(a.TimeCreated) - new Date(b.TimeCreated));

                // add event without overwriting them
                for (const event of formattedEvents) {
                    fs.appendFileSync(logFileName, JSON.stringify(event, null, 4) + ',\n', 'utf8');
                }

                console.log('new events detected and logged:');
                console.log(JSON.stringify(formattedEvents, null, 4));
            } catch (e) {
                console.error('error parsing realtime events:', e.message);
                console.error('raw data:', data.toString());
            }
        });

        realtimePs.stderr.on('data', (data) => {
            console.error(`powershell error (realtime log): ${data}`);
        });

        process.on('SIGINT', () => {
            console.log('signal interrupt. halting execution.');
            realtimePs.kill();
            process.exit();
        });
    } catch (e) {
        console.error('error parsing initial events:', e.message);
    }
});
