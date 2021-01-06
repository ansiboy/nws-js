const nws = require("maishu-node-web-server");
const { JavaScriptProcessor } = require("./out/java-script-processor");

/**@type {nws.LoadPlugin} */
let loadPlugin = (w) => {
    let p = new JavaScriptProcessor();
    let staticFileProcessor = w.requestProcessors.find(nws.StaticFileProcessor);
    if (staticFileProcessor) {
        p.basePath = staticFileProcessor.staticPath;
    }
    w.requestProcessors.add(p);
}
module.exports = { default: loadPlugin };