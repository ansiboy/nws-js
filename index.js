const nws = require("maishu-node-web-server");
const { JavaScriptProcessor } = require("./out/java-script-processor");

/**@type {nws.LoadPlugin} */
let loadPlugin = (w) => {
    let p = new JavaScriptProcessor();
    w.requestProcessors.add(p);
}
module.exports = loadPlugin;