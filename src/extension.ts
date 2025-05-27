// src/extension.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WebSocket, AddressInfo } from 'ws';
import { exec } from 'child_process';

const HOME_DIR = os.homedir();
const INFO_FILE = path.join(HOME_DIR, '.vscode_instances.json');
const PID = process.pid;


function readInstances(): Record<string, any> {
    try {
        if (fs.existsSync(INFO_FILE)) {
            const data = fs.readFileSync(INFO_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Failed to read instance file:', err);
    }
    return {};
}


function writeInstances(data: Record<string, any>) {
    try {
        fs.writeFileSync(INFO_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Failed to write instance file:', err);
    }
}


function updateInstance(address:AddressInfo) {
    const instances = readInstances();

    instances[PID] = {
        name: vscode.workspace.rootPath ?? '[no_project]',
        pid: PID,
        host: 'localhost',
        port: address.port,
        //hwnd: vscode.window.nativeHandle // something is not implemented about this api
    };

    writeInstances(instances);
}


function removeInstance() {
    const instances = readInstances();

    if (instances[PID]) {
        delete instances[PID];
        writeInstances(instances);
    }
}


function getFunctionParams(fn: Function): string[] {
  const fnStr = fn.toString().replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments
  const args = fnStr.match(/^[\s\S]*?\(([^)]*)\)/);
  if (!args) return [];
  return args[1]
    .split(',')
    .map(arg => arg.trim())
    .filter(arg => arg);
}


export function activate(context: vscode.ExtensionContext) {
    const wss = new WebSocket.Server({ port: 0 });
    (globalThis as any)['vscode']=vscode; // Need to add it manually

    wss.on('connection', (ws) => {
        console.log('Python connected');
        ws.on('message', (message) => {
            try {
                const { command, args }:{command: string; args: string[]; } = JSON.parse(message.toString());
                if (command === 'showMessage') {
                    vscode.window.showInformationMessage(command,...args);
                    const response = {
                        "status":"OK"
                        };
                    ws.send(JSON.stringify(response));
                } else if (command === 'eval') {
                    const result=eval(args[0])
                    const response = {
                        "status":"OK",
                        "result":result
                        };
                    ws.send(JSON.stringify(response));
                } else if (command === 'queryApi') {
                    const name = args[0];
                    const obj = (globalThis as any)[name];
                    if (!obj) {
                        console.error(`Object '${name}' not found.`);
                        return;
                    }
                    // get the object contents
                    const members=Object.keys(obj)
                    // return as response
                    const response = {
                        "status":"OK",
                        "members":members
                        };
                    ws.send(JSON.stringify(response));
                } else if (command === 'inspect') {
                    var obj:any=globalThis;
                    var name:string='';
                    if(args.length>0) {
                        name=args[0];
                    }
                    for(const k of name.split(".")) {
                        if(k!='') {
                            obj=obj[k];
                            if(obj===undefined) {
                                const msg=`'${k}' not found in '${name}'.`;
                                console.error(msg);
                                const response = {
                                    "status":"ERROR",
                                    "message":msg
                                    };
                                ws.send(JSON.stringify(response));
                                return;
                            }
                        }
                    }
                    var members:any={};
                    for(let memberName of Object.keys(obj)) {
                        var memberObj=undefined;
                        try {
                            memberObj=obj[memberName];
                        } catch(Exception) {}
                        members[memberName]={
                            'name':memberName,
                            'type':typeof(memberObj)
                        };
                        if ('object'===typeof(memberObj)) {
                            members[memberName]['params']=getFunctionParams(memberObj);
                        } else if('function'===typeof(memberObj)) {
                            members[memberName]['params']=getFunctionParams(memberObj);
                        }
                    }
                    // return as response
                    const response = {
                        "status":"OK",
                        "members":members
                        };
                    ws.send(JSON.stringify(response));
                } else {
                    const response = {
                        "status":"ERROR",
                        "message":"Unknown command"
                        };
                    ws.send(JSON.stringify(response));
                    console.error('Unknown command:', command);
                }
            } catch (err) {
                const response = {
                    "status":"ERROR",
                    "message":String(err)
                    };
                ws.send(JSON.stringify(response));
                console.error('Error handling message:', err);
            }
        });
    });
	vscode.window.showInformationMessage("Bridge activated!");
    const address:AddressInfo=wss.address() as AddressInfo
    updateInstance(address);
    console.log(`Registered VSCode bridge instance ${PID} on port ${address.port}`);
	vscode.window.showInformationMessage(`Registered VSCode bridge instance ${PID} on port ${address.port}`);
}


export function deactivate() {
    removeInstance();
    console.log(`Unregistered VSCode bridge instance ${PID}`);
}
