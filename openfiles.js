/**
 * Openfiles plugin for Cloud9 IDE
 *
 * @copyright 2011, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

 define(function(require, exports, module) {
    main.consumes = [
        "plugin", "tabManager", "menus", "commands", "settings", "tree", "fs", "ui"
    ];
    main.provides = ["openfiles"];
    return main;

    function main(options, imports, register) {
        var Plugin   = imports.plugin;
        var tabs     = imports.tabManager;
        var menus    = imports.menus;
        var commands = imports.commands;
        var settings = imports.settings;
        var tree     = imports.tree;
        var fs       = imports.fs;
        var ui       = imports.ui;

        var Tree     = require("ace_tree/tree");
        var TreeData = require("./openfilesdp");

        /***** Initialization *****/

        var plugin        = new Plugin("Ajax.org", main.consumes);
        var emit          = plugin.getEmitter();
        var staticPrefix  = options.staticPrefix;

        // tree maximum height
        var MAX_HEIGHT    = window.outerHeight / 5;
        var showOpenFiles = true;

        // UI Elements
        var ofDataProvider, ofTree, treeParent, winFileTree;

        var loaded = false;
        function load(){
            if (loaded) return false;
            loaded = true;

            // Hook events to get the focussed tab
            tabs.on("focusSync", updateOpenFiles);
            tabs.on("tabDestroy", updateOpenFiles);
            tabs.on("tabOrder", updateOpenFiles);

            commands.addCommand({
                name: "toggleOpenfiles",
                exec: function() {
                    settings.set("user/openfiles/@show", !showOpenFiles);
                    toggleOpenfiles(!showOpenFiles);
                }
            }, plugin);

            menus.addItemByPath("View/Open Files", new ui.item({
                type    : "check",
                checked : "[{settings.model}::user/openfiles/@show]",
                command : "toggleOpenfiles"
            }), 200, plugin);

            settings.on("read", function(e){
                // Defaults
                settings.setDefaults("user/openfiles", [["show", "true"]]);

                toggleOpenfiles(settings.getBool("user/openfiles/@show"));
            }, plugin);

            draw();
        }

        var drawn = false;
        function draw(){
            if (drawn) return;
            drawn = true;

            // ace_tree customization '.openfiles'
            // ui.insertCss(require("text!./openfiles.css"), staticPrefix, plugin);

            tree.getElement("winOpenfiles", function(winOpenfiles) {
                treeParent = winOpenfiles;

                tree.getElement("winFileTree", function(winFileTreeL) {
                    winFileTree = winFileTreeL;
                });

                // Create the Ace Tree
                ofTree = new Tree(treeParent.$int);
                ofDataProvider = new TreeData();
                ofTree.renderer.setScrollMargin(0, 10);
                // Assign the dataprovider
                ofTree.setDataProvider(ofDataProvider);
                // Some global render metadata
                ofDataProvider.staticPrefix = staticPrefix;

                ofDataProvider.on("select", function(){
                    setTimeout(onSelect, 40);
                });

                if (showOpenFiles)
                    updateOpenFiles();
                else
                    hideOpenFiles();

                var splitter = treeParent.parentNode.$handle;
                splitter.on("dragmove", updateOpenFiles);
                splitter.on("dragdrop", updateOpenFiles);

                emit("draw");
            });
        }

        /***** Methods *****/

        function updateOpenFiles() {
            if (!showOpenFiles)
                return;

            draw();
            var activeTabs   = tabs.getPanes();
            var focussedTab = tabs.focussedTab;
            var selected;

            root = activeTabs.map(function (pane, i) {
                return {
                    // name: pane.name (tab0 ...)
                    items: pane.getTabs()
                        .filter(function(tab){ return tab.path && tab.loaded; })
                        .map(function (tab) {
                        var node = {
                            name : fs.getFilename(tab.path),
                            path : tab.path,
                            items: [],
                            tab : tab
                         };
                         if (tab === focussedTab)
                            selected = node;
                        return node;
                    })
                };
            }).filter(function (pane) {
                return !!pane.items.length;
            }).map(function (node, i) {
                node.name = "GROUP " + (i+1);
                return node;
            });

            // Hide the openfiles
            if (!root.length)
                return hideOpenFiles();

            treeParent.show();

            if (root.length === 1)
                root = root[0];

            ofDataProvider.setRoot(root, selected);
            ofTree.resize(true);

            var treeHeight = ofTree.renderer.layerConfig.maxHeight + 3;
            var parentHeight = treeParent.getHeight();

            if (parentHeight < MAX_HEIGHT) {
                if (treeHeight < parentHeight)
                    treeParent.setHeight(treeHeight);
                else
                    treeParent.setHeight(Math.min(treeHeight, MAX_HEIGHT));
            }
            else
                treeParent.setHeight(treeParent.getHeight());

            ofTree.resize(true);
            // ofTree.renderer.scrollCaretIntoView(ofDataProvider.$selectedNode, 0.5);
        }

        function onSelect() {
            var node = ofDataProvider.$selectedNode;
            tabs.focusTab(node.path);
        }

        function hideOpenFiles() {
            treeParent && treeParent.hide();
        }

        function toggleOpenfiles(show) {
            if (show === showOpenFiles)
                return;
            showOpenFiles = show;

            if (!show)
                hideOpenFiles();
            else
                updateOpenFiles();

            emit("visible", {value: show});
        }

        /***** Lifecycle *****/
        plugin.on("load", function(){
            load();
        });
        plugin.on("enable", function(){

        });
        plugin.on("disable", function(){

        });
        plugin.on("unload", function(){
            loaded = false;
            drawn  = false;
        });

        /***** Register and define API *****/
        /**
         **/
        plugin.freezePublicAPI({
        });

        register(null, {
            openfiles: plugin
        });
    }
});
