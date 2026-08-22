"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowsGUIOperator = void 0;
exports.createWindowsOperator = createWindowsOperator;
const child_process_1 = require("child_process");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const os_1 = require("os");
function runPowerShell(script) {
    return new Promise((resolve, reject) => {
        (0, child_process_1.execFile)('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
            windowsHide: true,
            timeout: 30000,
            maxBuffer: 1024 * 1024 * 8,
        }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr || error.message));
                return;
            }
            resolve(stdout.trim());
        });
    });
}
function pointFromAction(action) {
    const x = action.inputs.startX;
    const y = action.inputs.startY;
    if (typeof x !== 'number' || typeof y !== 'number') {
        throw new Error(`Action ${action.type} requires startX and startY`);
    }
    return { x: Math.round(x), y: Math.round(y) };
}
function psString(value) {
    return `'${value.replace(/'/g, "''")}'`;
}
class WindowsGUIOperator {
    name = 'windows-native';
    screenshotDir = (0, path_1.join)((0, os_1.tmpdir)(), 'oxygen-claw-screenshots');
    async initialize() {
        if (process.platform !== 'win32') {
            throw new Error('WindowsGUIOperator only supports Windows');
        }
        await (0, promises_1.mkdir)(this.screenshotDir, { recursive: true });
    }
    async screenshot() {
        const file = (0, path_1.join)(this.screenshotDir, `screenshot-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);
        const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Left, $bounds.Top, 0, 0, $bitmap.Size)
$bitmap.Save(${psString(file)}, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
Write-Output "$($bounds.Width),$($bounds.Height)"
`.trim();
        const output = await runPowerShell(script);
        const [widthText, heightText] = output.split(',');
        const buffer = await (0, promises_1.readFile)(file);
        await (0, promises_1.rm)(file, { force: true });
        return {
            base64: buffer.toString('base64'),
            scaleFactor: 1,
            width: Number(widthText) || 0,
            height: Number(heightText) || 0,
        };
    }
    async execute(action) {
        const timestamp = Date.now();
        try {
            if (action.type === 'wait' || action.type === 'screenshot') {
                await new Promise(resolve => setTimeout(resolve, action.type === 'wait' ? 1000 : 100));
                return { success: true, action, observation: `${action.type} completed`, timestamp };
            }
            if (action.type === 'finished' || action.type === 'call_user') {
                return { success: true, action, observation: action.type, timestamp };
            }
            if (action.type === 'type') {
                const content = action.inputs.content || '';
                await runPowerShell(`Set-Clipboard -Value ${psString(content)}; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`);
                return { success: true, action, observation: `Typed ${content.length} characters`, timestamp };
            }
            if (action.type === 'hotkey') {
                const key = action.inputs.key || '';
                await runPowerShell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(${psString(this.toSendKeys(key))})`);
                return { success: true, action, observation: `Pressed hotkey ${key}`, timestamp };
            }
            if (action.type === 'click' || action.type === 'left_double' || action.type === 'right_single') {
                const { x, y } = pointFromAction(action);
                const right = action.type === 'right_single';
                const double = action.type === 'left_double';
                await runPowerShell(this.mouseScript(x, y, right, double));
                return { success: true, action, observation: `${action.type} at ${x}, ${y}`, timestamp };
            }
            if (action.type === 'drag') {
                const start = pointFromAction(action);
                const endX = action.inputs.endX;
                const endY = action.inputs.endY;
                if (typeof endX !== 'number' || typeof endY !== 'number') {
                    throw new Error('drag requires endX and endY');
                }
                await runPowerShell(this.dragScript(start.x, start.y, Math.round(endX), Math.round(endY)));
                return { success: true, action, observation: `Dragged from ${start.x}, ${start.y} to ${Math.round(endX)}, ${Math.round(endY)}`, timestamp };
            }
            if (action.type === 'scroll') {
                const { x, y } = pointFromAction(action);
                const delta = action.inputs.direction === 'up' ? 600 : -600;
                await runPowerShell(this.scrollScript(x, y, delta));
                return { success: true, action, observation: `Scrolled ${action.inputs.direction || 'down'}`, timestamp };
            }
            if (action.type === 'navigate' && action.inputs.url) {
                await runPowerShell(`Start-Process ${psString(action.inputs.url)}`);
                return { success: true, action, observation: `Opened ${action.inputs.url}`, timestamp };
            }
            return { success: false, action, error: `Unsupported action type: ${action.type}`, timestamp };
        }
        catch (error) {
            return { success: false, action, error: error instanceof Error ? error.message : String(error), timestamp };
        }
    }
    async getContext() {
        const screenshot = await this.screenshot();
        let activeWindow = '';
        try {
            activeWindow = await runPowerShell('Add-Type -AssemblyName System.Windows.Forms; (Get-Process | Where-Object {$_.MainWindowHandle -ne 0} | Sort-Object StartTime -Descending | Select-Object -First 1 -ExpandProperty MainWindowTitle)');
        }
        catch {
            activeWindow = '';
        }
        return { screenshot, activeWindow };
    }
    async cleanup() {
        await (0, promises_1.rm)(this.screenshotDir, { recursive: true, force: true });
    }
    toSendKeys(key) {
        return key
            .replace(/ctrl\+/gi, '^')
            .replace(/control\+/gi, '^')
            .replace(/alt\+/gi, '%')
            .replace(/shift\+/gi, '+')
            .replace(/enter/gi, '{ENTER}')
            .replace(/escape/gi, '{ESC}')
            .replace(/tab/gi, '{TAB}')
            .replace(/backspace/gi, '{BACKSPACE}')
            .replace(/delete/gi, '{DELETE}');
    }
    mousePrelude() {
        return `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MouseApi {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}
"@
`.trim();
    }
    mouseScript(x, y, right, double) {
        const down = right ? '0x0008' : '0x0002';
        const up = right ? '0x0010' : '0x0004';
        const clicks = double ? 2 : 1;
        return `${this.mousePrelude()}
[MouseApi]::SetCursorPos(${x}, ${y}) | Out-Null
for ($i = 0; $i -lt ${clicks}; $i++) { [MouseApi]::mouse_event(${down}, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 50; [MouseApi]::mouse_event(${up}, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 80 }`;
    }
    dragScript(startX, startY, endX, endY) {
        return `${this.mousePrelude()}
[MouseApi]::SetCursorPos(${startX}, ${startY}) | Out-Null
[MouseApi]::mouse_event(0x0002, 0, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 100
[MouseApi]::SetCursorPos(${endX}, ${endY}) | Out-Null
Start-Sleep -Milliseconds 100
[MouseApi]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)`;
    }
    scrollScript(x, y, delta) {
        return `${this.mousePrelude()}
[MouseApi]::SetCursorPos(${x}, ${y}) | Out-Null
[MouseApi]::mouse_event(0x0800, 0, 0, ${delta}, [UIntPtr]::Zero)`;
    }
}
exports.WindowsGUIOperator = WindowsGUIOperator;
function createWindowsOperator() {
    return new WindowsGUIOperator();
}
//# sourceMappingURL=windows-operator.js.map