"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
require("reflect-metadata");
const path_1 = require("path");
const glob = __importStar(require("glob"));
const cli_core_1 = require("@tsed/cli-core");
const cli_generate_swagger_1 = require("@tsed/cli-generate-swagger");
const di_1 = require("@tsed/di");
function isClass(entity) {
    return typeof entity === 'function' && /^class\s/.test(Function.prototype.toString.call(entity));
}
function loadControllers(patterns) {
    const controllers = [];
    patterns.forEach(pattern => {
        const files = glob.sync(pattern, { absolute: true, cwd: process.cwd() });
        files.forEach(file => {
            const module = require((0, path_1.resolve)(__dirname, file));
            Object.keys(module).forEach(key => {
                if (isClass(module[key]) && Reflect.getMetadataKeys(module[key]).includes('tsed:class:store')) {
                    controllers.push(module[key]);
                }
            });
        });
    });
    return controllers;
}
let Server = class Server {
};
exports.Server = Server;
exports.Server = Server = __decorate([
    (0, di_1.Configuration)({
        mount: {
            "/": loadControllers(process?.env?.CONTROLLERS_PATTERNS?.split(',') || []),
        },
        swagger: [
            {
                path: "/api-docs"
            }
        ]
    })
], Server);
cli_core_1.CliCore.bootstrap({
    server: Server,
    commands: [cli_generate_swagger_1.GenerateSwaggerCmd]
}).catch(err => console.error("Error: " + err));
//# sourceMappingURL=generate-tsed-swagger.js.map