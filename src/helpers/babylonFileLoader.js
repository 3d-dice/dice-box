import { Logger } from "@babylonjs/core/Misc/logger";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
/** @hidden */
export var _BabylonLoaderRegistered = true;
/**
 * Helps setting up some configuration for the babylon file loader.
 */

/** 
 * NOTE: This is a pared down version of the babylon file loader to just load what I need
 * Original babylonFileLoader is @babylonjs/core/Loading/Plugins/ 
 */

var BabylonFileLoaderConfiguration = /** @class */ (function () {
    function BabylonFileLoaderConfiguration() {
    }
    /**
     * The loader does not allow injecting custom physics engine into the plugins.
     * Unfortunately in ES6, we need to manually inject them into the plugin.
     * So you could set this variable to your engine import to make it work.
     */
    BabylonFileLoaderConfiguration.LoaderInjectedPhysicsEngine = false;
    return BabylonFileLoaderConfiguration;
}());
export { BabylonFileLoaderConfiguration };

var isDescendantOf = function (mesh, names, hierarchyIds) {
    for (var i in names) {
        if (mesh.name === names[i]) {
            hierarchyIds.push(mesh.id);
            return true;
        }
    }
    if (mesh.parentId && hierarchyIds.indexOf(mesh.parentId) !== -1) {
        hierarchyIds.push(mesh.id);
        return true;
    }
    return false;
};
var logOperation = function (operation, producer) {
    return operation + " of " + (producer ? producer.file + " from " + producer.name + " version: " + producer.version + ", exporter version: " + producer.exporter_version : "unknown");
};

SceneLoader.RegisterPlugin({
    name: "babylon.js",
    extensions: ".json",
    canDirectLoad: function (data) {
        if (data.indexOf("json") !== -1) {
            return true;
        }
        return true;
    },
    importMesh: function (meshesNames, scene, data, rootUrl, meshes, particleSystems, skeletons, onError) {
        // Entire method running in try block, so ALWAYS logs as far as it got, only actually writes details
        // when SceneLoader.debugLogging = true (default), or exception encountered.
        // Everything stored in var log instead of writing separate lines to support only writing in exception,
        // and avoid problems with multiple concurrent .babylon loads.
        var log = "importMesh has failed JSON parse";
        try {
            var parsedData = JSON.parse(data);
            // Force physics off
            parsedData.physicsEnabled = false
            parsedData?.meshes.map(mesh => delete mesh.physicsImpostor)

            log = "";

            var fullDetails = SceneLoader.loggingLevel === SceneLoader.DETAILED_LOGGING;
            if (!meshesNames) {
                meshesNames = null;
            }
            else if (!Array.isArray(meshesNames)) {
                meshesNames = [meshesNames];
            }
            var hierarchyIds = new Array();
            if (parsedData.meshes !== undefined && parsedData.meshes !== null) {
                var index;
                var cache;
                for (index = 0, cache = parsedData.meshes.length; index < cache; index++) {
                    var parsedMesh = parsedData.meshes[index];
                    if (meshesNames === null || isDescendantOf(parsedMesh, meshesNames, hierarchyIds)) {
                        if (meshesNames !== null) {
                            // Remove found mesh name from list.
                            delete meshesNames[meshesNames.indexOf(parsedMesh.name)];
                        }
                        var mesh = Mesh.Parse(parsedMesh, scene, rootUrl);
                        meshes.push(mesh);
                        log += "\n\tMesh " + mesh.toString(fullDetails);
                    }
                }
                // Connecting parents and lods
                var currentMesh;
                for (index = 0, cache = scene.meshes.length; index < cache; index++) {
                    currentMesh = scene.meshes[index];
                    if (currentMesh._waitingParentId) {
                        currentMesh.parent = scene.getLastEntryByID(currentMesh._waitingParentId);
                        currentMesh._waitingParentId = null;
                    }
                    currentMesh.computeWorldMatrix(true);
                }
            }
            
            return true;
        }
        catch (err) {
            var msg = logOperation("importMesh", parsedData ? parsedData.producer : "Unknown") + log;
            if (onError) {
                onError(msg, err);
            }
            else {
                Logger.Log(msg);
                throw err;
            }
        }
        finally {
            if (log !== null && SceneLoader.loggingLevel !== SceneLoader.NO_LOGGING) {
                Logger.Log(logOperation("importMesh", parsedData ? parsedData.producer : "Unknown") + (SceneLoader.loggingLevel !== SceneLoader.MINIMAL_LOGGING ? log : ""));
            }
        }
        return false;
    },
    load: function (scene, data, rootUrl, onError) {
        // Entire method running in try block, so ALWAYS logs as far as it got, only actually writes details
        // when SceneLoader.debugLogging = true (default), or exception encountered.
        // Everything stored in var log instead of writing separate lines to support only writing in exception,
        // and avoid problems with multiple concurrent .babylon loads.
        var log = "importScene has failed JSON parse";
        try {
            var parsedData = JSON.parse(data);
            log = "";
            if (parsedData.clearColor !== undefined && parsedData.clearColor !== null) {
                scene.clearColor = Color4.FromArray(parsedData.clearColor);
            }
            var container = loadAssetContainer(scene, data, rootUrl, onError, true);
            if (!container) {
                return false;
            }
            // Finish
            return true;
        }
        catch (err) {
            var msg = logOperation("importScene", parsedData ? parsedData.producer : "Unknown") + log;
            if (onError) {
                onError(msg, err);
            }
            else {
                Logger.Log(msg);
                throw err;
            }
        }
        finally {
            if (log !== null && SceneLoader.loggingLevel !== SceneLoader.NO_LOGGING) {
                Logger.Log(logOperation("importScene", parsedData ? parsedData.producer : "Unknown") + (SceneLoader.loggingLevel !== SceneLoader.MINIMAL_LOGGING ? log : ""));
            }
        }
        return false;
    },
    loadAssetContainer: function (scene, data, rootUrl, onError) {
        var container = loadAssetContainer(scene, data, rootUrl, onError);
        return container;
    }
});