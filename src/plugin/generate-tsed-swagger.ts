import 'reflect-metadata';
import { resolve } from 'path';
import * as glob from "glob";
import { CliCore } from "@tsed/cli-core";
import { GenerateSwaggerCmd } from "@tsed/cli-generate-swagger";
import { Configuration } from "@tsed/di";

function isClass(entity: any): boolean {
    return typeof entity === 'function' && /^class\s/.test(Function.prototype.toString.call(entity));
}
function loadControllers(patterns: Array<string>): any[] {
    const controllers: any[] = [];

    patterns.forEach(pattern => {
        const files = glob.sync(pattern, { absolute: true, cwd: process.cwd() });

        files.forEach(file => {
            const module = require(resolve(__dirname, file));
            Object.keys(module).forEach(key => {
                if (isClass(module[key]) && Reflect.getMetadataKeys(module[key]).includes('tsed:class:store')) {
                    controllers.push(module[key]);
                }
            });
        });
    });

    return controllers;
}

@Configuration({
    mount: {
        "/": loadControllers(process?.env?.CONTROLLERS_PATTERNS?.split(',') || []),
    },
    swagger: [
        {
            path: "/api-docs",
            specVersion: "3.0.1"
        }
    ]
})
export class Server {}

CliCore.bootstrap({
    server: Server,
    commands: [GenerateSwaggerCmd]
}).catch(err => console.error("Error: " + err));