import { getLogger, RequestContext, RequestProcessor, RequestResult } from "maishu-node-web-server";
import * as fs from "fs";
import * as babel from "@babel/core";

import { transformJS } from "./transform/transform-js.js";
import { transformTS } from "./transform/transform-ts.js";
import * as path from "path";

interface Options {
    babel: { [key: string]: babel.TransformOptions },
    // 脚本夹的虚拟路径
    directoryPath?: string,
    ignorePaths: string[],
}

export class JavaScriptProcessor implements RequestProcessor {

    private options: Options = {
        babel: {
            "\\S+.ts$": {
                "presets": [
                    ["@babel/preset-env", {
                        "targets": { chrome: 58 }
                    }],
                ],
                plugins: [
                    "@babel/plugin-transform-typescript",
                ]
            },
            "\\S+.js$": {
                "presets": [
                    ["@babel/preset-env", {
                        "targets": { chrome: 58 }
                    }],
                ],
                plugins: [
                ]
            },
            "\\S+.tsx$": {
                "presets": [
                    ["@babel/preset-env", {
                        "targets": { chrome: 58 }
                    }],
                ],
                plugins: [
                    ["@babel/plugin-transform-typescript", { isTSX: true }],
                    ["@babel/plugin-transform-react-jsx", { "pragma": "React.createElement", "pragmaFrag": "React.Fragment" }],
                ]
            },
            "\\S+.jsx$": {
                "presets": [
                    ["@babel/preset-env", {
                        "targets": { chrome: 58 }
                    }],
                ],
                plugins: [
                    ["@babel/plugin-transform-react-jsx", { "pragma": "React.createElement", "pragmaFrag": "React.Fragment" }],
                ]
            },
        },
        ignorePaths: ["\\S+node_modules\\S+", "\\S+lib\\S+"],
    }

    get babelOptions(): { [key: string]: babel.TransformOptions } {
        return this.options.babel;
    }
    set babelOptions(value) {
        this.options.babel = value;
    }

    /** 获取 JS 忽略的路径 */
    get ignorePaths(): string[] {
        return this.options.ignorePaths;
    }
    /** 设置 JS 忽略的路径，设置了该路径，对于匹配的 JS 文件不进行转换处理 */
    set ignorePaths(value) {
        this.options.ignorePaths = value;
    }

    /** 获取脚本夹的虚拟路径 */
    get directoryPath(): string | undefined {
        return this.options.directoryPath;
    };
    /** 设置脚本夹的虚拟路径 */
    set directoryPath(value: string | undefined) {
        this.options.directoryPath = value;
    }

    async execute(ctx: RequestContext): Promise<RequestResult | null> {
        if (!ctx.virtualPath.endsWith(".js") && !ctx.virtualPath.endsWith(".ts") &&
            !ctx.virtualPath.endsWith(".jsx") && !ctx.virtualPath.endsWith(".tsx"))
            return null;

        let pathWidthoutExt: string = ctx.virtualPath;
        if (pathWidthoutExt.endsWith(".js")) {
            pathWidthoutExt = pathWidthoutExt.substring(0, pathWidthoutExt.length - ".js".length);
        }

        if (pathWidthoutExt.endsWith(".ts") || pathWidthoutExt.endsWith(".tsx")) {
            let ext = path.extname(pathWidthoutExt);
            pathWidthoutExt = pathWidthoutExt.substr(0, pathWidthoutExt.length - ext.length);
        }

        let jsVirtualPath = pathWidthoutExt + ".js";
        let jsxVirtualPath = pathWidthoutExt + ".jsx";
        let tsVirtualPath = pathWidthoutExt + ".ts";
        let tsxVirtualPath = pathWidthoutExt + ".tsx";

        let dir = this.directoryPath ? ctx.rootDirectory.findDirectory(this.directoryPath) : ctx.rootDirectory;
        if (!dir)
            return null;

        let physicalPath = dir.findFile(jsVirtualPath);
        if (physicalPath == null) {
            physicalPath = dir.findFile(jsxVirtualPath);
        }

        if (physicalPath == null) {
            physicalPath = dir.findFile(tsVirtualPath);
        }

        if (physicalPath == null) {
            physicalPath = dir.findFile(tsxVirtualPath);
        }

        if (physicalPath == null) {
            return null;
        }

        let isTS = physicalPath.endsWith(".ts") || physicalPath.endsWith(".tsx");
        let isJS = !isTS;
        let skip = false;
        if (isJS) {
            for (let i = 0; i < this.ignorePaths.length; i++) {
                let regex = new RegExp(this.ignorePaths[i]);
                if (regex.test(ctx.virtualPath)) {
                    skip = true;
                    break;
                }
            }
        }

        if (skip)
            return null;


        let pkg = require("../package.json");
        let logger = getLogger(pkg.name, ctx.logLevel);
        logger.info(`Physical path is ${physicalPath}.`);

        let buffer = fs.readFileSync(physicalPath);
        let code = buffer.toString();
        let options: babel.TransformOptions | undefined;


        for (let key in this.babelOptions) {
            let regex = new RegExp(key);
            if (regex.test(physicalPath)) {
                options = this.babelOptions[key];
                logger.info(`Babel option key is ${key}.`);
                break;
            }
        }

        if (options) {
            logger.info(`Babel option is:\n`);
            logger.info(JSON.stringify(options, null, "    "));
            if (isTS) {
                code = transformTS(code, options);
            }
            else {
                code = transformJS(code, options);
            }
        }

        code = `// Physical Path:${physicalPath}\r\n${code}`;

        const encoding = 'UTF-8';
        return { content: code, headers: { "content-type": `application/x-javascript; charset=${encoding}` } };
    }

    static transformJS(originalCode: string, options: babel.TransformOptions) {
        return transformJS(originalCode, options);
    }

    static transformTS(originalCode: string, options: babel.TransformOptions) {
        return transformTS(originalCode, options);
    }
}