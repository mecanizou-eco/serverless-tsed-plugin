import "reflect-metadata";
import * as glob from "glob";
import * as path from "path";
import * as fs from "fs";
import { exec } from 'child_process';
import {
    ArrayLiteralExpression,
    ClassDeclaration,
    Identifier,
    Project,
    SyntaxKind
} from "ts-morph";

interface DecoratorStructureItem {
    values: any[];
    children?: {
        [key: string]: DecoratorStructureItem
    };
}

interface DecoratorStructure {
    [key: string]: Array<DecoratorStructureItem>;
}

/**
 * TsEDPlugin class for integrating Ts.ED with Serverless framework.
 */
class TsEDPlugin {
    serverless: any;
    options: any;
    hooks: any;
    resolvedSchemas = new Set();

    /**
     * Constructor to initialize the plugin with serverless and options.
     * @param serverless - The serverless instance.
     * @param options - The options passed to the plugin.
     */
    constructor(serverless: any, options: any) {
        this.serverless = serverless;
        this.options = options;
        this.hooks = {
            "before:package:initialize": this.beforePackage.bind(this),
            "before:offline:start": this.beforePackage.bind(this),
        };
    }

    /**
     * Parses decorator arguments from a string.
     * @param args - The arguments string.
     * @returns An array of parsed arguments.
     */
    parseDecoratorArguments(args: string): any[] {
        try {
            return JSON.parse(`[${args}]`);
        } catch (e) {
            return args.split(",").map(arg => arg.trim());
        }
    }

    /**
     * Parses nested arguments from a string.
     * @param args - The arguments string.
     * @returns An object representing the nested arguments structure.
     */
    parseNestedArguments(args: string): { [key: string]: DecoratorStructureItem } {
        const structure: { [key: string]: DecoratorStructureItem } = {};
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
    getDecoratorStructure(methodName: string, cls: ClassDeclaration): DecoratorStructure {
        const method = cls.getInstanceMethod(methodName);
        const decoratorStructure: DecoratorStructure = {};
        if (!method) return {};

        method.forEachDescendant(node => {
            if (node.getKind() === SyntaxKind.Decorator) {
                const decoratorText = node.getText();
                const parts = decoratorText.match(/@\(?(\w+)\(([^)]*)\)/);
                if (!parts) return;

                const decoratorName = parts[1];
                const args = parts[2];

                const values = this.parseDecoratorArguments(args);
                if (!decoratorStructure[decoratorName]) {
                    decoratorStructure[decoratorName] = [];
                }

                if (/\.\w+\(/.test(decoratorText)) {
                    const nestedStructure = this.parseNestedArguments(decoratorText);
                    decoratorStructure[decoratorName].push({ values, children: nestedStructure });
                } else {
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
                            const paramTypeObj = param.getType();
                            const paramTypeSymbol = paramTypeObj.getSymbol();
                            const paramType = paramTypeSymbol ? paramTypeSymbol.getName() : paramTypeObj.getText();

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

        await this.generateSwaggerFiles(options.patterns.controller);

        const swagger = await this.loadSwagger();
        const models = this.generateAPIGatewayModels(swagger);
        const functions = await this.processFiles(files, options, swagger);

        this.updateServerlessYml(functions, models);
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
    getFiles(patterns: string[]): string[] {
        let files: string[] = [];
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
    generateFunctionName(methodType: string, controllerPath: string, methodPath: string): string {
        const cleanPath = (str: string) => str.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        const cleanedControllerPath = cleanPath(controllerPath);
        const cleanedMethodPath = cleanPath(methodPath);

        const cleanedControllerPathParts = cleanedControllerPath.split('-').filter(part => part);
        const cleanedMethodPathParts = cleanedMethodPath.split('-').filter(part => part);

        if (cleanedMethodPathParts.length > 0) {
            return `${methodType}-${cleanedControllerPathParts.join('-')}-${cleanedMethodPathParts.join('-')}`;
        } else {
            return `${methodType}-${cleanedControllerPathParts.join('-')}`;
        }
    }

    /**
     * Checks if the file name contains a dot.
     * @param filePath - The file path.
     * @returns True if the file name contains a dot, false otherwise.
     */
    hasDotInFileName(filePath: string): boolean {
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
    getControllerPaths(sourceFile: any, file: any): Array<string> {
        const controllerPaths: string[] = [];

        sourceFile.forEachDescendant((node: any) => {
            if (node.getKind() === SyntaxKind.PropertyAssignment && node.getFirstChild()?.getText() === 'lambda') {
                const initializer = node.getLastChild();
                if (initializer && initializer.getKind() === SyntaxKind.ArrayLiteralExpression) {
                    const arrayLiteral = initializer as ArrayLiteralExpression;
                    const elements = arrayLiteral.getElements();

                    elements.forEach(element => {
                        if (element.getKind() === SyntaxKind.Identifier) {
                            const identifier = element as Identifier;

                            sourceFile.getImportDeclarations().forEach((importDeclaration: any) => {
                                const isImportController = importDeclaration.getNamedImports().find((name: any) => name.getName() === identifier.getText());

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
     * Resolve the schema recursively, handling $ref and avoiding infinite loops.
     * @param schema - The schema to resolve.
     * @param swagger - The Swagger definition containing the schemas.
     * @param resolvedSchemas - A Map to keep track of resolved schemas.
     * @returns The resolved schema.
     */
    resolveSchema(
        schema: any,
        swagger: any,
        definitions: Record<string, any>,
        resolvedSchemas: Map<string, any> = new Map()
    ): any {
        if (!schema) return undefined;

        // Remove `openapi` key if present
        if (schema.openapi) {
            delete schema.openapi;
        }

        // Handle $ref (references to other schemas)
        if (schema.$ref) {
            const modelName = schema.$ref.replace(/^#\/(definitions|components\/schemas)\//, '');

            if (resolvedSchemas.has(modelName)) {
                return { $ref: `#/definitions/${modelName}` };
            }

            // Prevent circular references by temporarily setting to a placeholder
            resolvedSchemas.set(modelName, {}); // Placeholder object to break circular references

            // Recursively resolve the referenced schema
            const resolvedSchema = this.resolveSchema(
                swagger.definitions?.[modelName] || swagger.components?.schemas?.[modelName],
                swagger,
                definitions,
                resolvedSchemas
            );

            resolvedSchemas.set(modelName, resolvedSchema);
            definitions[modelName] = resolvedSchema; // Add to definitions
            return { $ref: `#/definitions/${modelName}` };
        }

        // Handle array types
        if (schema.type === 'array' && schema.items) {
            return {
                ...schema,
                items: this.resolveSchema(schema.items, swagger, definitions, resolvedSchemas)
            };
        }

        // Handle object types
        if (schema.type === 'object' && schema.properties) {
            const properties = Object.keys(schema.properties).reduce((acc: Record<string, any>, key: string) => {
                acc[key] = this.resolveSchema(schema.properties[key], swagger, definitions, resolvedSchemas);

                if (acc[key] && acc[key].example) {
                    delete acc[key].example;
                }

                return acc;
            }, {});
            return {
                ...schema,
                properties
            };
        }

        // Handle anyOf, oneOf, allOf
        ['anyOf', 'oneOf', 'allOf'].forEach((keyword) => {
            if (schema[keyword]) {
                schema[keyword] = schema[keyword].map((subSchema: any) => {
                    return this.resolveSchema(subSchema, swagger, definitions, resolvedSchemas);
                });
            }
        });

        // Replace `nullable` keyword with a combination of types if present
        if (schema.nullable) {
            if (schema.anyOf || schema.oneOf || schema.allOf) {
                ['anyOf', 'oneOf', 'allOf'].forEach((keyword) => {
                    if (schema[keyword]) {
                        schema[keyword].push({ type: 'null' });
                    }
                });
            } else {
                schema.type = Array.isArray(schema.type) ? [...schema.type, 'null'] : [schema.type, 'null'];
            }
            delete schema.nullable;
        }

        return schema;
    }

    /**
     * Extracts schema from Swagger definition.
     * @param modelName - The model name.
     * @param swagger - The Swagger definition.
     * @returns The extracted schema.
     */
    extractSchemaFromSwagger(modelName: string, swagger: any): any {
        const swaggerDefinition = swagger?.definitions?.[modelName] || swagger?.components?.schemas?.[modelName];
        if (swaggerDefinition) {
            const definitions: Record<string, any> = {};
            const resolvedSchema = this.resolveSchema(swaggerDefinition, swagger, definitions);

            const schema = {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "$ref": `#/definitions/${modelName}`,
                "definitions": {
                    ...definitions,
                    [modelName]: resolvedSchema
                }
            };

            return schema;
        }

        return undefined;
    }

    /**
     * Extracts parameter from Swagger definition.
     * @param modelName - The model name.
     * @param swagger - The Swagger definition.
     * @returns The extracted schema.
     */
    extractParameterFromSwagger(parameterName: string, parameterType: "path" | "query", endpoint: string, method: string, swagger: any): any {
        const swaggerParameters = swagger?.paths?.[endpoint]?.[method]?.parameters;
        if (swaggerParameters) {
            return swaggerParameters.find((parameter: any) => parameter?.in === parameterType && parameter?.name === parameterName)
        }

        return undefined;
    }

    /**
     * Returns a list of models for Serverless resources.
     * @param swagger - The Swagger definition.
     * @returns An object representing the models for resources.
     */
    generateAPIGatewayModels(swagger: any): { [key: string]: any } {
        const apiModels: { [key: string]: any } = {
            'EmptyModel': {
                Type: "AWS::ApiGateway::Model",
                Properties: {
                    RestApiId: {
                        Ref: "ApiGatewayRestApi"
                    },
                    ContentType: "application/json",
                    Name: 'EmptyModel',
                    Schema: {
                        type: 'object',
                        properties: {}
                    }
                }
            }
        };
        const documentationModels: { [key: string]: any } = {
            'EmptyModel': {
                contentType: "application/json",
                name: 'EmptyModel',
                schema: {
                    type: 'object',
                    properties: {}
                }
            }
        };

        const schemaNames = Object.keys(swagger?.definitions || {}).concat(Object.keys(swagger?.components?.schemas || {}));
        schemaNames.forEach(schemaName => {
            const schema = this.extractSchemaFromSwagger(schemaName, swagger);
            if (schema) {
                documentationModels[schemaName+'Model'] = {
                    contentType: "application/json",
                    name: schemaName,
                    schema: schema
                };
                apiModels[schemaName+'Model'] = {
                    Type: "AWS::ApiGateway::Model",
                    Properties: {
                        RestApiId: {
                            Ref: "ApiGatewayRestApi"
                        },
                        ContentType: "application/json",
                        Name: schemaName,
                        Schema: schema
                    }
                };
            }
        });

        return {
            apiModels: apiModels,
            documentationModels: documentationModels
        };
    }

    /**
     * Converte a primeira letra de uma string para maiúscula e o restante para minúscula.
     *
     * @param {string} text - A string que será convertida.
     * @returns {string} - A string resultante com a primeira letra em maiúscula e as demais em minúscula.
     */
    capitalizeFirstLetter(text: string): string {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    /**
     * Processes files to generate functions for Serverless.
     * @param files - The files to process.
     * @param options - The options for processing.
     * @params swagger - The swagger file generated by tsed
     * @returns An object representing the functions.
     */
    async processFiles(files: string[], options: any, swagger: any): Promise<{ [key: string]: any }> {
        const functions: { [key: string]: any } = {};
        const project = new Project();

        files.forEach(moduleFile => {
            if (this.hasDotInFileName(moduleFile)) {
                throw new Error("It should not contain '.'(dot) in the file name " + moduleFile);
            }

            const sourceFile = project.addSourceFileAtPath(moduleFile);
            const controllerFiles: string[] = this.getControllerPaths(sourceFile, moduleFile);

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
                        const serviceName = this.serverless.service.service;
                        const stage = this.serverless.service.provider.stage;
                        const responses: any = {
                            headers: {
                                "Content-Type": "'application/json'"
                            },
                            statusCodes: {}
                        };
                        const documentation: any = {
                            summary: decorators?.["Summary"]?.[0]?.values?.[0],
                            description: decorators?.["Description"]?.[0]?.values?.[0],
                            methodResponses: [],
                            queryParams: [],
                            pathParams: []
                        };

                        const bodySchema: any = {
                            schema: undefined,
                            name: undefined
                        };
                        let handlerPath = path.relative(process.cwd(), moduleFile).replace(/\\/g, "/");
                        handlerPath = handlerPath.replace(/\.[tj]s$/, "");

                        if (decorators?.["BodyParams"]?.[0]) {
                            const requestBody = decorators["BodyParams"][0].values;
                            if (requestBody?.[0]) {
                                bodySchema.schema = this.extractSchemaFromSwagger(requestBody[0].type, swagger);
                                bodySchema.name = `${this.capitalizeFirstLetter(methodType)}${requestBody[0].type}`;
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

                                    responses.statusCodes[response?.values?.[0]] = {
                                        pattern: `.*"statusCode":${response?.values?.[0]},.*`,
                                        headers: {
                                            "Content-Type": "application/json"
                                        },
                                        body: {
                                            schema: schema
                                        }
                                    };

                                    documentation.methodResponses.push({
                                        "statusCode": response?.values?.[0],
                                        "responseModels": {
                                            "application/json": response?.values?.[1]
                                        },
                                        "responseParameters": {
                                            "method.response.header.Content-Type": true
                                        }
                                    })
                                }
                            })
                        } else {
                            const statusCode = methodType !== 'post' ? 200 : 201;
                            responses.statusCodes[statusCode] = {
                                pattern: '',
                                headers: {
                                    "Content-Type": "application/json"
                                },
                            };

                            documentation.methodResponses.push({
                                "statusCode": statusCode,
                                "responseModels": {
                                    "application/json": 'Empty'
                                },
                                "responseParameters": {
                                    "method.response.header.Content-Type": true
                                }
                            })
                        }

                        functions[functionName] = {
                            name: `${serviceName}-${stage}-${functionName}`,
                            handler: `${handlerPath}.${key}`,
                            environment: options.environment,
                            memorySize: options.memorySize,
                            events: [
                                {
                                    http: {
                                        path: `${controllerPath}${formattedMethodPath || ""}`,
                                        method: methodType,
                                        cors: options?.events?.http?.cors || undefined,
                                        authorizer: this.hasAuthorizationHeader(decorators, options?.authorizer?.HeaderName) ? {
                                            name: options.authorizer.functionName,
                                            type: 'REQUEST',
                                            identityValidationExpression: '^Bearer [A-Za-z0-9-_]+\.([A-Za-z0-9-_]+)?\.([A-Za-z0-9-_]+)?$',
                                            identitySource: `method.request.header.${options.authorizer.HeaderName}`
                                        } : undefined,
                                        request: {
                                            schemas: bodySchema.schema ? {
                                                "application/json": {
                                                    schema: bodySchema.schema,
                                                    name: bodySchema.name
                                                },
                                            } : undefined
                                        },
                                        response: responses,
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
    hasAuthorizationHeader(decorators: DecoratorStructure, headerName: string): boolean {
        const headerDecorator = decorators['In']?.find(item => item?.values?.[0]?.toLowerCase()?.includes('header'));
        return headerDecorator?.children?.['Name']?.values?.[0]?.toLowerCase() === headerName?.toLowerCase();
    }

    /**
     * Retrieves the controller path from a class declaration.
     * @param cls - The class declaration.
     * @returns The controller path.
     */
    getControllerPath(cls: ClassDeclaration): string {
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
    getControllerMethods(cls: ClassDeclaration): any[] {
        const methods: any[] = [];
        const instanceMethods = cls.getInstanceMethods();

        instanceMethods.forEach((method: any) => {
            const decorators = method.getDecorators();
            decorators.forEach((decorator: any) => {
                const name = decorator.getName();
                if (['Get', 'Post', 'Put', 'Delete', 'Patch', 'Trace', 'Options', 'Connect', 'Head'].includes(name)) {
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
    async generateSwaggerFiles(patternsController: Array<string>) {
        const env = Object.create(process.env);
        env.CONTROLLERS_PATTERNS = patternsController.map(pattern => path.join(process.cwd(), pattern)).join(",");

        const command = `ts-node -r tsconfig-paths/register ${__dirname}/generate-tsed-swagger.ts generate-swagger --output ./.tsed/swagger`;

        return new Promise((resolve, reject) => {
            exec(command, {env}, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error: ${error.message}`);
                    reject(error);
                    return;
                }
                if (stderr) {
                    console.error(`stderr: ${stderr}`);
                    reject(stderr);
                }

                console.log(`stdout: ${stdout}`);
                resolve(stdout);
            });
        });
    }

    /**
     * Loads the Swagger definition from the file system.
     * @returns The Swagger definition.
     */
    loadSwagger(): any {
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
     * @param apiGatewayModels - The API Gateway Models to use as request and response endpoints
     */
    updateServerlessYml(functions: { [key: string]: any }, apiGatewayModels: { [key: string]: any }) {
        const service = this.serverless.service;

        service.functions = {
            ...functions,
            ...service.functions,
        };

        service.custom.documentation = {
            ...apiGatewayModels.documentationModels,
            ...service.custom.documentation,
        };

        service.resources.Resources = {
            ...apiGatewayModels.apiModels,
            ...service.resources.Resources,
        };

        service.update({
            functions: service.functions,
            resources: service.resources,
            custom: service.custom
        });
    }
}

export = TsEDPlugin;