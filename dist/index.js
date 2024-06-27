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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
require("reflect-metadata");
const glob = __importStar(require("glob"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const ts_morph_1 = require("ts-morph");
/**
 * TsEDPlugin class for integrating Ts.ED with Serverless framework.
 */
class TsEDPlugin {
    serverless;
    options;
    hooks;
    /**
     * Constructor to initialize the plugin with serverless and options.
     * @param serverless - The serverless instance.
     * @param options - The options passed to the plugin.
     */
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.hooks = {
            "before:package:createDeploymentArtifacts": this.beforePackage.bind(this),
            "before:offline:start": this.beforePackage.bind(this),
        };
    }
    /**
     * Parses decorator arguments from a string.
     * @param args - The arguments string.
     * @returns An array of parsed arguments.
     */
    parseDecoratorArguments(args) {
        try {
            return JSON.parse(`[${args}]`);
        }
        catch (e) {
            return args.split(",").map(arg => arg.trim());
        }
    }
    /**
     * Parses nested arguments from a string.
     * @param args - The arguments string.
     * @returns An object representing the nested arguments structure.
     */
    parseNestedArguments(args) {
        const structure = {};
        const regex = /(\w+)\(([^)]+)\)/g;
        let match;
        while ((match = regex.exec(args)) !== null) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/['"]/g, '');
            structure[key] = { values: [value] };
        }
        return structure;
    }
    /**
     * Retrieves the decorator structure for a given method in a class.
     * @param methodName - The name of the method.
     * @param cls - The class declaration.
     * @returns The decorator structure.
     */
    getDecoratorStructure(methodName, cls) {
        const method = cls.getInstanceMethod(methodName);
        const decoratorStructure = {};
        if (!method)
            return {};
        method.forEachDescendant(node => {
            if (node.getKind() === ts_morph_1.SyntaxKind.Decorator) {
                const decoratorText = node.getText();
                const parts = decoratorText.match(/@(\w+)\(([^)]*)\)/);
                if (!parts)
                    return;
                const decoratorName = parts[1];
                const args = parts[2];
                const values = this.parseDecoratorArguments(args);
                if (!decoratorStructure[decoratorName]) {
                    decoratorStructure[decoratorName] = [];
                }
                if (/\.\w+\(/.test(decoratorText)) {
                    const nestedStructure = this.parseNestedArguments(decoratorText);
                    decoratorStructure[decoratorName].push({ values, children: nestedStructure });
                }
                else {
                    decoratorStructure[decoratorName].push({ values });
                }
            }
        });
        method.getParameters().forEach(param => {
            param.getDecorators().forEach(decorator => {
                const decoratorName = decorator.getName();
                if (!decoratorStructure[decoratorName]) {
                    decoratorStructure[decoratorName] = [];
                }
                method.getParameters().forEach((param, index) => {
                    const decorators = param.getDecorators();
                    decorators.forEach(decorator => {
                        if (decorator.getText().includes(decoratorName)) {
                            const paramName = param.getName();
                            const paramType = param.getType().getText();
                            decoratorStructure[decoratorName][index] = { values: [], children: {} };
                            decoratorStructure[decoratorName][index].values.push({
                                name: paramName,
                                type: paramType,
                            });
                        }
                    });
                });
            });
        });
        return decoratorStructure;
    }
    /**
     * Hook to be executed before packaging the deployment artifacts.
     */
    async beforePackage() {
        const serverless = this.serverless;
        const options = serverless.service.custom[this.getPluginName()] || {};
        options.patterns = options.patterns || {};
        options.patterns.module = options.patterns.module || ["**/*module.ts"];
        options.patterns.controller = options.patterns.controller || ["**/*controller.ts"];
        const files = this.getFiles(options.patterns.module);
        const functions = await this.processFiles(files, options);
        this.updateServerlessYml(functions);
    }
    /**
     * Retrieves the plugin name.
     * @returns The plugin name.
     */
    getPluginName() {
        return "tsedPlugin";
    }
    /**
     * Retrieves files matching the given patterns.
     * @param patterns - The patterns to match files.
     * @returns An array of file paths.
     */
    getFiles(patterns) {
        let files = [];
        patterns.forEach(pattern => {
            files = files.concat(glob.sync(pattern, { absolute: true, cwd: process.cwd() }));
        });
        return files;
    }
    /**
     * Generates a function name based on method type, controller path, and method path.
     * @param methodType - The HTTP method type.
     * @param controllerPath - The controller path.
     * @param methodPath - The method path.
     * @returns The generated function name.
     */
    generateFunctionName(methodType, controllerPath, methodPath) {
        const cleanPath = (str) => str.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const cleanedControllerPath = cleanPath(controllerPath);
        const cleanedMethodPath = cleanPath(methodPath);
        const cleanedControllerPathParts = cleanedControllerPath.split('-').filter(part => part);
        const cleanedMethodPathParts = cleanedMethodPath.split('-').filter(part => part);
        if (cleanedMethodPathParts.length > 0) {
            return `${methodType}-${cleanedControllerPathParts.join('-')}-${cleanedMethodPathParts.join('-')}`;
        }
        else {
            return `${methodType}-${cleanedControllerPathParts.join('-')}`;
        }
    }
    /**
     * Checks if the file name contains a dot.
     * @param filePath - The file path.
     * @returns True if the file name contains a dot, false otherwise.
     */
    hasDotInFileName(filePath) {
        const fileName = path.basename(filePath);
        const fileNameWithoutExtension = fileName.replace(/\.[^/.]+$/, "");
        return fileNameWithoutExtension.includes(".");
    }
    /**
     * Retrieves controller paths from a source file.
     * @param sourceFile - The source file.
     * @param file - The file path.
     * @returns An array of controller paths.
     */
    getControllerPaths(sourceFile, file) {
        const controllerPaths = [];
        sourceFile.forEachDescendant((node) => {
            if (node.getKind() === ts_morph_1.SyntaxKind.PropertyAssignment && node.getFirstChild()?.getText() === 'lambda') {
                const initializer = node.getLastChild();
                if (initializer && initializer.getKind() === ts_morph_1.SyntaxKind.ArrayLiteralExpression) {
                    const arrayLiteral = initializer;
                    const elements = arrayLiteral.getElements();
                    elements.forEach(element => {
                        if (element.getKind() === ts_morph_1.SyntaxKind.Identifier) {
                            const identifier = element;
                            sourceFile.getImportDeclarations().forEach((importDeclaration) => {
                                const isImportController = importDeclaration.getNamedImports().find((name) => name.getName() === identifier.getText());
                                if (isImportController) {
                                    const importPath = importDeclaration.getModuleSpecifier().getText().replace(/['"]/g, '');
                                    const controllerPath = path.resolve(path.dirname(file), importPath);
                                    if (!controllerPaths.includes(controllerPath)) {
                                        controllerPaths.push(controllerPath + ".ts");
                                    }
                                }
                            });
                        }
                    });
                }
            }
        });
        return controllerPaths;
    }
    /**
     * Extracts schema from Swagger definition.
     * @param modelName - The model name.
     * @param swagger - The Swagger definition.
     * @returns The extracted schema.
     */
    extractSchemaFromSwagger(modelName, swagger) {
        const swaggerDefinition = swagger?.definitions?.[modelName];
        if (swaggerDefinition) {
            return {
                "$schema": "http://json-schema.org/draft-07/schema#",
                ...swaggerDefinition
            };
        }
        return undefined;
    }
    /**
     * Extracts parameter from Swagger definition.
     * @param modelName - The model name.
     * @param swagger - The Swagger definition.
     * @returns The extracted schema.
     */
    extractParameterFromSwagger(parameterName, parameterType, endpoint, method, swagger) {
        const swaggerParameters = swagger?.paths?.[endpoint]?.[method]?.parameters;
        if (swaggerParameters) {
            return swaggerParameters.find((parameter) => parameter?.in === parameterType && parameter?.name === parameterName);
        }
        return undefined;
    }
    /**
     * Processes files to generate functions for Serverless.
     * @param files - The files to process.
     * @param options - The options for processing.
     * @returns An object representing the functions.
     */
    async processFiles(files, options) {
        const functions = {};
        const project = new ts_morph_1.Project();
        await this.generateSwaggerFiles(options.patterns.controller);
        const swagger = await this.loadSwagger();
        files.forEach(moduleFile => {
            if (this.hasDotInFileName(moduleFile)) {
                throw new Error("It should not contain '.'(dot) in the file name " + moduleFile);
            }
            const sourceFile = project.addSourceFileAtPath(moduleFile);
            const controllerFiles = this.getControllerPaths(sourceFile, moduleFile);
            controllerFiles.forEach(controllerFile => {
                const sourceFile = project.addSourceFileAtPath(controllerFile);
                const classes = sourceFile.getClasses();
                classes.forEach(cls => {
                    const controllerPath = this.getControllerPath(cls);
                    const methods = this.getControllerMethods(cls);
                    methods.forEach(method => {
                        const { key, methodType, methodPath } = method;
                        const functionName = this.generateFunctionName(methodType, controllerPath, methodPath);
                        const decorators = this.getDecoratorStructure(method.key, cls);
                        const formattedMethodPath = methodPath.replace(/\/:([^/]+)/g, '/{$1}');
                        const documentation = {
                            summary: decorators?.["Summary"]?.[0]?.values?.[0],
                            description: decorators?.["Description"]?.[0]?.values?.[0],
                            methodResponses: [],
                            queryParams: [],
                            pathParams: []
                        };
                        let bodySchema = undefined;
                        let handlerPath = path.relative(process.cwd(), moduleFile).replace(/\\/g, "/");
                        handlerPath = handlerPath.replace(/\.[tj]s$/, "");
                        if (decorators?.["BodyParams"]?.[0]) {
                            const requestBody = decorators["BodyParams"][0].values;
                            if (requestBody?.[0]) {
                                bodySchema = this.extractSchemaFromSwagger(requestBody[0].type, swagger);
                            }
                        }
                        if (decorators?.["QueryParams"]) {
                            decorators?.["QueryParams"].forEach(param => {
                                if (param?.values?.[0]) {
                                    const schemaParam = this.extractParameterFromSwagger(param.values[0]?.name, "query", `${controllerPath}${formattedMethodPath || ""}`, methodType, swagger);
                                    if (schemaParam) {
                                        documentation.queryParams.push({
                                            name: schemaParam.name,
                                            required: schemaParam.required,
                                            schema: {
                                                type: schemaParam.type
                                            }
                                        });
                                    }
                                }
                            });
                        }
                        if (decorators?.["PathParams"]) {
                            decorators?.["PathParams"].forEach(param => {
                                if (param?.values?.[0]) {
                                    const schemaParam = this.extractParameterFromSwagger(param.values[0]?.name, "path", `${controllerPath}${formattedMethodPath || ""}`, methodType, swagger);
                                    if (schemaParam) {
                                        documentation.pathParams.push({
                                            name: schemaParam.name,
                                            required: schemaParam.required,
                                            schema: {
                                                type: schemaParam.type
                                            }
                                        });
                                    }
                                }
                            });
                        }
                        if (decorators?.["Returns"]) {
                            decorators["Returns"].forEach((response) => {
                                if (response?.values?.[1]) {
                                    const schema = this.extractSchemaFromSwagger(response?.values?.[1], swagger);
                                    if (schema) {
                                        documentation.methodResponses.push({
                                            statusCode: response?.values?.[0],
                                            responseBody: {
                                                schema: schema
                                            }
                                        });
                                    }
                                }
                            });
                        }
                        functions[functionName] = {
                            handler: `${handlerPath}.${key}`,
                            environment: options.environment,
                            memorySize: options.memorySize,
                            events: [
                                {
                                    http: {
                                        path: `${controllerPath}${formattedMethodPath || ""}`,
                                        method: methodType,
                                        cors: options.events.http.cors,
                                        authorizer: this.hasAuthorizationHeader(decorators, options.authorizer.HeaderName) ? {
                                            name: options.authorizer.functionName,
                                            identitySource: `method.request.header.${options.authorizer.HeaderName}`
                                        } : undefined,
                                        request: {
                                            schemas: bodySchema ? {
                                                "application/json": bodySchema
                                            } : undefined
                                        },
                                        documentation: documentation
                                    }
                                }
                            ]
                        };
                    });
                });
            });
        });
        return functions;
    }
    /**
     * Checks if the authorization header is present in the decorators.
     * @param decorators - The decorator structure.
     * @param headerName - The header name.
     * @returns True if the authorization header is present, false otherwise.
     */
    hasAuthorizationHeader(decorators, headerName) {
        const headerDecorator = decorators['In']?.find(item => item?.values?.[0]?.toLowerCase()?.includes('header'));
        return headerDecorator?.children?.['Name']?.values?.[0]?.toLowerCase() === headerName?.toLowerCase();
    }
    /**
     * Retrieves the controller path from a class declaration.
     * @param cls - The class declaration.
     * @returns The controller path.
     */
    getControllerPath(cls) {
        const decorators = cls.getDecorators();
        for (const decorator of decorators) {
            if (decorator.getName() === 'Controller') {
                const args = decorator.getArguments();
                if (args.length > 0) {
                    return args[0].getText().replace(/['"]/g, '');
                }
            }
        }
        return '';
    }
    /**
     * Retrieves the controller methods from a class declaration.
     * @param cls - The class declaration.
     * @returns An array of controller methods.
     */
    getControllerMethods(cls) {
        const methods = [];
        const instanceMethods = cls.getInstanceMethods();
        instanceMethods.forEach((method) => {
            const decorators = method.getDecorators();
            decorators.forEach((decorator) => {
                const name = decorator.getName();
                if (['Get', 'Post', 'Put', 'Delete', 'Path'].includes(name)) {
                    const args = decorator.getArguments();
                    methods.push({
                        key: method.getName(),
                        methodType: name.toLowerCase(),
                        methodPath: args.length > 0 ? args[0].getText().replace(/['"]/g, '') : ''
                    });
                }
            });
        });
        return methods;
    }
    /**
     * Generates Swagger files based on controller patterns.
     * @param patternsController - The controller patterns.
     */
    async generateSwaggerFiles(patternsController) {
        const env = Object.create(process.env);
        env.CONTROLLERS_PATTERNS = patternsController.map(pattern => path.join(process.cwd(), pattern)).join(",");
        const command = `ts-node -r tsconfig-paths/register ${__dirname}/../src/generate-tsed-swagger.ts generate-swagger --output ./.tsed/swagger`;
        (0, child_process_1.exec)(command, { env }, (error, stdout, stderr) => {
            console.log(`stdout: ${stdout}`);
            if (error) {
                console.error(`Error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`stderr: ${stderr}`);
                return;
            }
        });
    }
    /**
     * Loads the Swagger definition from the file system.
     * @returns The Swagger definition.
     */
    loadSwagger() {
        const swaggerPath = path.join(process.cwd(), ".tsed/swagger/api-docs/swagger.json");
        if (!fs.existsSync(swaggerPath)) {
            throw new Error(`Swagger file not found at path: ${swaggerPath}`);
        }
        const swaggerContent = fs.readFileSync(swaggerPath, "utf-8");
        return JSON.parse(swaggerContent);
    }
    /**
     * Updates the Serverless YAML configuration with the generated functions.
     * @param functions - The functions to update.
     */
    updateServerlessYml(functions) {
        const service = this.serverless.service;
        service.functions = {
            ...functions,
            ...service.functions,
        };
        console.log(JSON.stringify(service.functions));
        this.serverless.service.update({
            functions: service.functions
        });
    }
}
module.exports = TsEDPlugin;
//# sourceMappingURL=index.js.map